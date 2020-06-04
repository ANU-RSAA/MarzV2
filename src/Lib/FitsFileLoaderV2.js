import {convertVacuumFromAir, defaultFor} from "../Utils/methods";

import * as $q from "q";

import {setFitsFilename} from "../Stores/Data/Actions";
import path from 'path';
import "./fits";
import Spectra from "./Spectra";

class FitsFileLoader {

    // Map instruments to particular 'recipes' of read in functions
    instrumentPackages = [
//        {
//            "instrument": "LAMOST",
//            "headerkw": "TELESCOP",
//            "headervalue": "LAMOST",
//            "readfunc": parseLamostFitsFile
//        },
       {
           "instrument": "HERMES-2dF",
           "headerkw": "INSTRUME",
           "headervalue": "HERMES-2dF",
           "readfunc": this.parseHERMESFitsFile
       },
        {
            "instrument": "6dF",
            "headerkw": "INSTRUME",
            "headervalue": "SuperCOSMOS I",
            "readfunc": this.parse6dFGSFitsFile
        },
        {
            "instrument": "SDSS",
            "headerkw": "TELESCOP",
            "headervalue": "SDSS 2.5-M",
            "readfunc": this.parseSDSSFitsFile
        }
    ];

    wavelengthConversionFactors = {
    // These factors convert the named wavelength unit to angstrom
        'nm': 10.0
    };

    fluxConversionFactors = {
    // These factors convert the named flux unit to erg/s/cm/A
        'Wm2': 1000.0
    };

    constructor(processorService, resultsManager, node) {
        this.node = defaultFor(node, false);
        this.isLoading = false;
        this.hasFitsFile = false;
        this.originalFilename = null;
        this.filename = null;
        this.numExtensions = null;

        /*
        this.MJD = null;
        this.date = null;
        this.header0 = null;
        this.epoch = null;
        this.radecsys = null;
        this.JD = null;
        this.longitude = null;
        this.latitude = null;
        this.altitude = null;
        */

        this.resultGenerator = resultsManager;

        // We will now add all the metadata into the 'spectra' array
        this.spectra = null;
        this.primaryIndex = 0;
        this.numPoints = null;

        this.processorService = processorService;
        this.log = console;
        this.subscribed = [];

        this.filedata = null;
    }


    subscribeToInput(fn) {
        this.subscribed.push(fn);
    }

    setFilename(ifilename) {
        const actualName = path.basename(ifilename);
        this.isLoading = true;
        this.hasFitsFile = true;
        this.originalFilename = actualName.replace(/\.[^/.]+$/, "");
        // this.global.data.fitsFileName = this.originalFilename;
        this.filename = this.originalFilename.replace(/_/g, " ");
        this.thefilename = ifilename;
        this.actualName = actualName;
    }
    setFiledata(ifilename,ifiledata) {
        const actualName = path.basename(ifilename);
        this.isLoading = true;
        this.hasFitsFile = true;
        this.originalFilename = actualName.replace(/\.[^/.]+$/, "");
        //this.global.data.fitsFileName = this.originalFilename;
        this.filename = this.originalFilename.replace(/_/g, " ");
        this.thefilename = ifilename;
        this.actualName = actualName;
        this.thefiledata = ifiledata;
    }
    provide(q) {
        console.log(" ========== PROVIDE ==============");
        //const q = this.$q.defer();
        this.isLoading = true;
        this.hasFitsFile = true;
        const fileData = this.thefiledata;
        this.fits = new window.astro.FITS(fileData, () => {
            console.log("window.astro.FITS done its thing now parse "+this.filename+" "+this.originalFilename);
            this.parseFitsFile(q);
            this.processorService.setPause();
        });
        return q.promise;
    }

    loadInFitsFile(file) {
        const q = $q.defer();
        this.isLoading = true;
        this.hasFitsFile = true;
        let pass = file;
        if (file.actualName != null) {
            this.originalFilename = file.actualName.replace(/\.[^/.]+$/, "");
            pass = file.file;
        } else {
            this.originalFilename = file.name.replace(/\.[^/.]+$/, "");
        }
        setTimeout(() => setFitsFilename(this.originalFilename), 0);
        this.filename = this.originalFilename.replace(/_/g, " ");
        this.log.debug("Loading FITs file");
        this.fits = new astro.FITS(pass, () => {
            this.log.debug("Loaded FITS file "+this.filename+" "+this.originalFilename);
            console.log("Loaded FITS file "+this.filename+" "+this.originalFilename);
            this.parseFitsFile(q, this.originalFilename);
            this.processorService.setPause();
        });
        return q.promise;
    };

    readHeaderValue(extension, keyword, defaultValue) {
        // Attempt to read header keyword 'kw' from, in order:
        // - Extenstion ext
        // - Extension 0 (if ext != 0)
        // If neither succeeds, return the default value, which if it isn't specified, will be undefined.
        let val = undefined;
        try {
            val = this.fits.getHeader(extension).cards[keyword].value
        } catch (TypeError) {}
        if (val === undefined && extension !== 0) {
            try {
                val = this.fits.header0.cards[keyword].value
            } catch (TypeError) {}
        }
        if (val === undefined && defaultValue != undefined) {
            val = defaultValue;
        }
        return val
    }

    standardizeWavlUnit(wavlUnit) {
        if (wavlUnit === null) {
            return wavlUnit;
        }

        // Convert the wavelength into one of the standard values, based on
        // what kind of variations there normally are
        if (wavlUnit.match(/ang/i) || wavlUnit.match(/Ang/i) || wavlUnit.match(/aa/i)) {
            wavlUnit = "angstrom";
        } else if (wavlUnit.match(/nm/i) || wavlUnit.match(/nano/i)) {
            wavlUnit = "nm";
        } else if (wavlUnit.match(/cm/i) || wavlUnit.match(/centi/i)) {
            wavlUnit = "cm";
        } else if (wavlUnit.match(/micro/i)) {
            wavlUnit = "micron";
        }

        return wavlUnit;
    }

    parseFitsFile(q) {
        // q is the promise object to resolve

        // Read the header to get the file structure, and define which reader
        // functions to hand the file off to
        this.log.debug("Attempting to determine file structure");
        this.header0 = this.fits.getHDU(0).header;

        this.spectra = [];

        // Count the number of extensions within the file
        this.numExtensions = this.fits.hdus.length;

        // Check to see if this file matches one of the special file types with a custom read in
        this.customFileType = null;
        this.customFileRead = null;
        for (let i = 0; i < this.instrumentPackages.length; i++) {
            const pkg = this.instrumentPackages[i];
            if (this.readHeaderValue(0, pkg["headerkw"]) === pkg["headervalue"]) {
                this.customFileType = pkg["instrument"];
                this.customFileRead = pkg["readfunc"];
                break;
            }
        }

        if (this.customFileType) {
            (this.customFileRead)(q);
        } else if (this.numExtensions === 1) {
            // If single-extension, pass off to the single extension reader(s)
            this.parseSingleExtensionFitsFile(q, 0)
        } else {
            // If multi-extension, pass off to the multi-extension reader
            this.parseMultiExtensionFitsFile(q);
        }
    }


    getWavelengthAxis(ext) {
        this.log.debug('Looking for wavelength axis');

        const wavlAxis = 0 ; // Default if CTYPE not found
        const wavlAxisName = [];

        for (let headerkw in this.header0.cards) {
            try {
                // Search through all the header keywords in the extension to see if one of them identifies itself as the wavelength axis identifier
                if ((this.fits.getHeader(ext).cards[headerkw].value.match(/wave/i) || this.fits.getHeader(ext).cards[headerkw].value.match(/lam/i)) && headerkw.indexOf("TYPE") !== -1) {
                    wavlAxisName.push(headerkw);
                }
            } catch (TypeError) {}
        }

        if (wavlAxisName.length !== 1) {
            console.log("Unable to determine wavelength axis - defauting to " + wavlAxis);
            return wavlAxis;
        }

        // Get the column index from the header keyword, by stripping off the
        // number at the end of the keyword
        // Need to subtract one because arrays in JavaScript are zero-indexed
        const wavColumnIndex = parseInt(wavlAxisName[0][wavlAxisName[0].length - 1]) - 1;
        console.log("Found wavelength axis = " + wavColumnIndex);
        return wavColumnIndex ;

    }

    getWavelengthsSpect(ext, wavlAxisIndex) {
        this.log.debug('Getting spectra wavelengths');
        const q = $q.defer();

        wavlAxisIndex = wavlAxisIndex || this.getWavelengthAxis(ext) + 1 ;  // Need to add one to come back to FITS indexing
        console.log("wavlAxis being used in getWavelengthSpect = " + wavlAxisIndex);
        this.numPoints = this.fits.getHDU(ext).data.naxis[wavlAxisIndex - 1] ;

        const crval = this.readHeaderValue(ext, "CRVAL" + wavlAxisIndex) || this.readHeaderValue(ext, "CV1_" + wavlAxisIndex);
        const crpix = this.readHeaderValue(ext, "CRPIX" + wavlAxisIndex) || this.readHeaderValue(ext, "CP1_" + wavlAxisIndex);
        const cdelt = this.readHeaderValue(ext, "CDELT" + wavlAxisIndex) || this.readHeaderValue(ext, "CD1_" + wavlAxisIndex);
        const scale = this.readHeaderValue(ext, "LOGSCALE") || "F";
        const needShift = this.readHeaderValue(ext, "VACUUM") || "T";

        if (crval == null || crpix == null || cdelt == null) {
            console.log("&&& PROMISE REJECTED && - Wavelength header values incorrect: CRVAL"+wavlAxisIndex+"=" + crval + ", CRPIX$"+wavlAxisIndex+"=" + crpix + ", CDELT"+wavlAxisIndex+"=" + cdelt + ".");
            q.reject("Wavelength header values incorrect: CRVAL"+wavlAxisIndex+"=" + crval + ", CRPIX"+wavlAxisIndex+"=" + crpix + ", CDELT"+wavlAxisIndex+"=" + cdelt + ".");
        } else {
            console.log("Found wavelength values: CRVAL"+wavlAxisIndex+"=" + crval + ", CRPIX"+wavlAxisIndex+"=" + crpix + ", CDELT"+wavlAxisIndex+"=" + cdelt + ".");
            console.log(this);
        }

        const lambdas = [];
        const lambda = [];
        if (scale === "T" || scale === 1 || scale === true) {
            for (let i = 0; i < this.numPoints; i++) {
                // RS: That is, they do not need to be converted???  TODO: Check with Marc
                lambda.push(((i + 1 - crpix) * cdelt) + crval);
            }
        } else {
            for (let i = 0; i < this.numPoints; i++) {
                lambda.push(((i + 1 - crpix) * cdelt) + crval);
            }
        }

        // If wavelength is not already in vacuum frame, shift it into vacuum from atmosphere
        if (needShift === null || needShift === 0 || needShift === "F" || needShift === false ) {
            convertVacuumFromAir(lambda);
        }

        // TODO: I dont understand why we have lambda and lambdas, when there is no loop her to get more than one element in lambdas.
        // MCW: From memory, I think this was so the output format for this function matched those of the table or
        // multi-extension wavelength read functions, where multiple wavelength scales might be returned
        lambdas.push(lambda);
        q.resolve(lambdas);
        console.log('Returning lambdas:');
        console.log(lambdas);
        console.log('This was from a noPoints value of ' + this.numPoints);

        return q.promise;
    }

    getWavelengthsTable(ext) {
        const q = $q.defer();
        console.log("Reading table wavelengths from extension " + ext);

        // Attempt to identify which table column the wavelength data are in
        const wavlTypeKW = [];
        const wavlColName = [];

        for (let headerkw in this.fits.getHeader(ext).cards) {
            try {
                if ((this.fits.getHeader(ext).cards[headerkw].value.match(/wave/i) || this.fits.getHeader(ext).cards[headerkw].value.match(/lam/i) ) && headerkw.indexOf("TYPE") !== -1) {
                    wavlTypeKW.push(headerkw);
                    wavlColName.push(this.fits.getHeader(ext).cards[headerkw].value);
                }
            } catch (TypeError) {}
        }

        if (wavlTypeKW.length !== 1) {
            console.log("&&& PROMISE REJECTED && - Unable to determine table column for wavelength ");
            console.log(wavlTypeKW);
            q.reject("Unable to determine table column for wavelength");
            return;
        }

        // Get the column index from the header keyword, by stripping off the
        // number at the end of the keyword
        // Need to subtract one because arrays in JavaScript are zero-indexed
        const wavColumnIndex = parseInt(wavlTypeKW[0][wavlTypeKW[0].length - 1]) - 1;

        // Extract the column data
        var col_data = [];
        console.log("Getting data from extension " + ext + ", column " + wavlColName[0]);
        console.log(this.fits.getDataUnit(ext));
        this.fits.getDataUnit(ext).getColumn(wavlColName[0], function (column) {
            console.log(">>> Inside wavelength read callback");
            col_data = column;

            // If 'log' was in the row name, we need to convert to 'actual' values
            if (wavlColName[0].match(/log/i)) {
                for (let i = 0; i < col_data.length; i++) {
                    col_data[i] = Math.pow(10, col_data[i]); // Just converting 'actual' values, no need to do e.g. deltas
                }
            }

            console.log(">>> Found wavelength data from table:");
            console.log(col_data);

            // Wavelength unit detection is done elsewhere
            q.resolve([col_data]);
        });

        return q.promise;

    }

    getWavelengthUnitTable(ext, colIndex) {
        const q = $q.defer();

        // Now need to make sure that the wavelength data are in angstroms
        let wavlUnit = null;
        // Attempt to read the straight-up header keyword types
        const foundWavlUnit = this.readHeaderValue(ext, "CTYPE " + colIndex) || this.readHeaderValue(ext, "TUNIT" + colIndex) || null ;
        if (foundWavlUnit === null) {
            wavlUnit = "pixel";
        }

        // Get the standard name for the wavl. unit
        wavlUnit = this.standardizeWavlUnit(wavlUnit);
        q.resolve(wavlUnit);
        return q.promise;

    }


    getWavelengthUnitSpect(ext, wavlAxisIndex) {
        const q = $q.defer();

        let wavlUnit = null ;
        wavlAxisIndex = wavlAxisIndex || this.getWavelengthAxis(ext) ;
        let foundWavlUnit = this.readHeaderValue(ext, "CUNIT" + wavlAxisIndex) || null ;
        console.log("Found wavelength unit " + foundWavlUnit);

        if (foundWavlUnit === null) {
            wavlUnit = "pixel" ;
        }

        // Get the standard name for the wavl. unit
        wavlUnit = this.standardizeWavlUnit(wavlUnit);
        q.resolve(wavlUnit);
        return q.promise;

    }


    getIntensitySpect(ext, wavlAxis) {
        const q = $q.defer();
        if (typeof(ext) == "undefined") {
            q.resolve([]);
            return q.promise;
        }

        // Check the shape of the data - if 1-d, just return the single column
        const dataDims = this.fits.getDataUnit(ext).naxis.length ;
        console.log("^^^ Found "+dataDims+" data dimensions ^^^");
        if (dataDims > 2) {
            console.log("&&& PROMISE REJECTED && - Marz cannot handle input images with more than two dimensions");
            q.reject("Marz cannot handle input images with more than two dimensions");
            return;
        }

        let intensitySpects = [];

        let spectdata;
        this.fits.getDataUnit(ext).getFrame(0, function(data) {
            spectdata = Array.prototype.slice.call(data) ;
            if (dataDims === 1) {
                // Simply return the data if its already 1D, easy as
                intensitySpects.push(spectdata);
            } else {

                // Otherwise, we need to slice up the data into constituent parts
                // This needs to be based off the naxis values of the input DataUnit,
                // as well as any flags indicating what the various axes are
                console.log("^^^ Looking to crack open multi-dimensional data ^^^");
                const dataAxis = 1 ;  // Default value if we can't find something explicit
                // We need to find the wavelength axis, as this is the axis to
                // 'slice' along to extract spectra
                wavlAxis = wavlAxis || this.getWavelengthAxis(ext);
                console.log("wavlAxis:");
                console.log(wavlAxis);

                // 0 is data is in rows (sequential), 1 otherwise
                const fluxAxis = wavlAxis;
                console.log("fluxAxis = " + fluxAxis);
                // Reverse of the above
                // const fluxAxisOpp = (fluxAxis + 1) % 2 ;
                const [rowLength, colLength] = this.fits.getDataUnit(ext).naxis;
                let startStep, startStop, iStep ;

                if (fluxAxis === 0) {
                    startStep = rowLength;
                    startStop = spectdata.length ;
                    iStep = 1;
                } else {
                    startStep = 1;
                    startStop = spectdata.length - colLength * (rowLength - 1) ;
                    iStep = colLength;
                }
                console.log("startStep = " + startStep + ", startStop = " + startStop + ", iStep = " + iStep);

                for (let start = 0; start < startStop ; start += startStep) {
                        let spect = [];
                        for (var i = 0; i < rowLength; i+= iStep) {
                            spect.push(spectdata[start + i]);
                        }
                        intensitySpects.push(spect) ;
                    }


            }
            console.log("intensitySpects:");
            console.log(intensitySpects);
            this.numPoints = intensitySpects[0].length ;
            q.resolve(intensitySpects);

        }.bind(this));

        return q.promise ;

    }

    getIntensityTable(ext) {
        const q = $q.defer();
        console.log("Reading table intensities from extension " + ext);

        // Attempt to identify which table column the wavelength data are in
        const intsTypeKW = [];
        const intsColName = [];

        for (let headerkw in this.fits.getHeader(ext).cards) {
            try {
                if ((this.fits.getHeader(ext).cards[headerkw].value.match(/flux/i) || this.fits.getHeader(ext).cards[headerkw].value.match(/inten/i) ) && headerkw.indexOf("TYPE") !== -1) {
                    intsTypeKW.push(headerkw);
                    intsColName.push(this.fits.getHeader(ext).cards[headerkw].value);
                }
            } catch (TypeError) {}
        }

        if (intsTypeKW.length !== 1) {
            console.log("&&& PROMISE REJECTED && - Unable to determine table column for intensity/flux ");
            console.log(intsTypeKW);
            q.reject("Unable to determine table column for intensity/flux");
            return;
        }

        // Get the column index from the header keyword, by stripping off the
        // number at the end of the keyword
        // Need to subtract one because arrays in JavaScript are zero-indexed
        const intColumnIndex = parseInt(intsTypeKW[0][intsTypeKW[0].length - 1]) - 1;

        // Extract the column data
        let col_data = [];
        console.log("Getting data from extension " + ext + ", column " + intsColName[0]);
        this.fits.getDataUnit(ext).getColumn(intsColName[0], function (column) {
            col_data = column;

            console.log(">>> Found intensity data from table:");
            console.log(col_data);

            // Wavelength unit detection is done elsewhere
            q.resolve([col_data, ]);
        });

        return q.promise;
    }


    getVarianceTable(ext) {
        const q = $q.defer();
        console.log("Reading table intensities from extension " + ext);

        // Attempt to identify which table column the wavelength data are in
        const intsTypeKW = [];
        const intsColName = [];
        const inverses = [];

        for (let headerkw in this.fits.getHeader(ext).cards) {
            try {
                if (this.fits.getHeader(ext).cards[headerkw].value.match(/var/i) && headerkw.indexOf("TYPE") !== -1) {
                    intsTypeKW.push(headerkw);
                    intsColName.push(this.fits.getHeader(ext).cards[headerkw].value);
                    if (this.fits.getHeader(ext).cards[headerkw].value.match(/ivar/i)) {
                        inverses.push(true);
                    } else {
                        inverses.push(false);
                    }
                }
            } catch (TypeError) {}
        }

        if (intsTypeKW.length !== 1) {
            console.log("&&& PROMISE REJECTED && - Unable to determine table column for intensity/flux ");
            console.log(intsTypeKW);
            q.reject("Unable to determine table column for intensity/flux");
            return;
        }

        // Extract the column data
        let col_data = [];
        console.log("Getting data from extension " + ext + ", column " + intsColName[0]);
        this.fits.getDataUnit(ext).getColumn(intsColName[0], function (column) {
            col_data = column;

            console.log(">>> Found intensity data from table:");
            console.log(col_data);

            if (inverses[0]) {
                console.log("Inverting variances");
                for (let j = 0; j < col_data.length; j++) {
                    col_data[j] = 1 / col_data[j];
                }
            }

            // Wavelength unit detection is done elsewhere
            q.resolve([col_data, ]);
        });

        return q.promise;
    }


    getSkyTable(ext) {
        const q = $q.defer();
        console.log("Reading table intensities from extension " + ext);

        // Attempt to identify which table column the wavelength data are in
        const intsTypeKW = [];
        const intsColName = [];

        for (let headerkw in this.fits.getHeader(ext).cards) {
            try {
                if (this.fits.getHeader(ext).cards[headerkw].value.match(/sky/i) && headerkw.indexOf("TYPE") !== -1) {
                    intsTypeKW.push(headerkw);
                    intsColName.push(this.fits.getHeader(ext).cards[headerkw].value);
                }
            } catch (TypeError) {}
        }

        if (intsTypeKW.length !== 1) {
            console.log("&&& PROMISE REJECTED && - Unable to determine table column for intensity/flux ");
            console.log(intsTypeKW);
            q.reject("Unable to determine table column for intensity/flux");
            return;
        }

        // Extract the column data
        let col_data = [];
        console.log("Getting data from extension " + ext + ", column " + intsColName[0]);
        this.fits.getDataUnit(ext).getColumn(intsColName[0], function (column) {
            col_data = column;

            console.log(">>> Found intensity data from table:");
            console.log(col_data);

            // Wavelength unit detection is done elsewhere
            q.resolve([col_data, ]);
        });

        return q.promise;
    }


    parseSingleExtensionFitsFile(q, ext) {
        console.log("Parsing Single Extension Fits File - extension " + ext);
        console.log(this.fits);
        ext = ext || 0 ;

        // Read header information into properties
        const spectrum = {
            'properties': {}
        };
        spectrum.properties["name"] = this.readHeaderValue(ext, "OBJID") || this.readHeaderValue("OBJNAME") || "";
        spectrum.properties["ra"] = this.readHeaderValue(ext, "RA") || "";
        spectrum.properties["dec"] = this.readHeaderValue(ext, "DEC") || "";
        spectrum.properties["juliandate"] = this.readHeaderValue(ext, "JD") || this.readHeaderValue(ext, "JULIAN") || this.readHeaderValue(ext, "MJD") || this.readHeaderValue(ext, "UTMJD") || "";
        spectrum.properties["longitude"] = this.readHeaderValue(ext, "LONG_OBS") || this.readHeaderValue(ext, "LONGITUD") || "";
        spectrum.properties["latitude"] = this.readHeaderValue(ext, "LAT_OBS") || this.readHeaderValue(ext, "LATITUDE") || "";
        spectrum.properties["altitude"] = this.readHeaderValue(ext, "ALT_OBS") || this.readHeaderValue(ext, "ALTITUDE") || "";
        spectrum.properties["epoch"] = this.readHeaderValue(ext, "EPOCH") || "";
        spectrum.properties["radecsys"] = this.readHeaderValue(ext, "RADECSYS") || "";
        spectrum.properties["magnitude"] = this.readHeaderValue(ext, "MAG") || "";

        // Now need to determine which flavour of information read functions
        // we need to send to
        // This is basically two flavours - table read, and spectrum (1D image) read
        // See if the data attribute attached to the astro FITS object has table
        // or image properties
        const isTableData = this.fits.getDataUnit(1).hasOwnProperty("rows");
        var isLamost;
        try {
            isLamost = this.fits.getHDU(0).header.cards["TELESCOP"].value === "LAMOST" || false;
        } catch {
            isLamost = false;
        }
        console.log("isLamost = " + isLamost);
        let wavlReadFunc, instReadFunc, varReadFunc, skyReadFunc, detailReadFunc, wavlUnitReadFunc, instUnitReadFunc;
        if (isTableData) {
            // console.log(this);
            // Assign table read functions
            wavlReadFunc = v => this.getWavelengthsTable(v);
            // console.log('^^^ wavlReadFunc is: ^^^');
            // console.log(wavlReadFunc);
            instReadFunc = v => this.getIntensityTable(v);
//            varReadFunc = this.getVarianceTable;
//            skyReadFunc = this.getSkyTable;
//            detailReadFunc = this.getDetailTable;
            wavlUnitReadFunc = v => this.getWavelengthUnitTable(v);
//            instUnitReadFunc = v => this.getIntensityUnitTable(v);
        } else if (isLamost) {
            // Assign LAMOST read functions
        } else {
            // Assign spectrum read functions
            instReadFunc = v => this.getIntensitySpect(v);
            wavlReadFunc = v => this.getWavelengthsSpect(v);
//            console.log('^^^ wavlReadFunc is: ^^^');
//            console.log(wavlReadFunc);

//            console.log('^^^ instReadFunc is: ^^^');
//            console.log(instReadFunc);
//            varReadFunc = this.getVarianceSpect;
//            skyReadFunc = this.getSkySpect;
//            detailReadFunc = this.getDetailSpect;
            wavlUnitReadFunc = v => this.getWavelengthUnitSpect(v);
//            instUnitReadFunc = v => this.getIntensityUnitSpect(v);
        }

        var spectra = [];

        $q.all([
            wavlReadFunc(ext),
            instReadFunc(ext),
//            varReadFunc(0),
//            skyReadFunc(0),
//            detailReadFunc(0),
            wavlUnitReadFunc(ext),
//            instUnitReadFunc(0)
        ]).then(function (data) {
            // Do any required stuff after reading all in
            console.log('^^^ parseSingleExtensionFitsFile promise chain succeeded - processing data ^^^');
            console.log('^^^ returned data is: ^^^');
            console.log(data);

            const wavls = data[0];
            console.log("^^^ wavls: ^^^");
            console.log(wavls);
            console.log("^^^ data[0]: ^^^");
            console.log(data[0]);
            const ints = data[1];
            console.log("^^^ ints: ^^^");
            console.log(ints);
            console.log("^^^ data[1]: ^^^");
            console.log(data[1]);
            console.log("^^^ This apparently has a length of "+data.length+" ^^^");
            const wavlUnit = data[2];

            console.log("^^^ Forming return JSON objects ^^^");
            for (let s=0; s < ints.length; s++) {
                console.log("^^^ -- Forming object "+s+" ^^^");
                let spec = new Spectra({
                    id: s,
                    wavelength: wavls[s],
                    intensity: ints[s],
                    wavelength_unit: wavlUnit
                });
                spectra.push(spec)
            }

            // Note that the calling function resolves the promise, not this one
            console.log('^^^ Returned spectra are: ^^^');
            console.log(spectra);

            q.resolve(spectra);

        }.bind(this), function (data) {
            console.error('!!! parseSingleExtensionFitsFile promise chain failed !!!');
            console.error(data);
        });

    }

    parseMultiExtensionFitsFile(q) {
        console.log("Parsing Multi Extension Fits File");

        // See if we are dealing with one of the following:
        // - Different data product (flux, var, sky etc) in each extension;
        // - Different object in each extension;
        // - Single extension with independent PHU
        // In the last two cases, we can re-use parseSingleExtensionFits

        // Let's see how many of the data extensions have data...

        console.log(this.fits);

        var exts_with_data = [];
        for (var i = 0; i < this.numExtensions; i++) {
            if (this.fits.getHDU(i).data !== undefined) {
                exts_with_data.push(i);
            }
        }

        if (exts_with_data.length === 1) {
            console.log("Passing over to a single-ext read of extension " + exts_with_data[0]);
            return this.parseSingleExtensionFitsFile(q, exts_with_data[0]);
        }

        // OK, so there's multiple extensions with data. Now need to see if
        // it's one object per extension, or different products for the same
        // object
        // We do this by checking for an EXTNAME attribute on the data
        // extensions, and seeing if we can find a variance extension
        // (That is, does EXTNAME contain the string 'var'?)
        // UPDATE: Also look for sigma, works for GALAH data
        var other_ext_found = false;
        for (var i = 0; i < this.numExtensions; i++) {
            if (this.readHeaderValue(i, "EXTNAME", "").match(/var/i) || this.readHeaderValue(i, "EXTNAME", "").match(/sigma/i)) {
                other_ext_found = true;
                break;
            }
        }
        if (!other_ext_found) {
            // Need to loop over the separate extensions in sequence, as we
            // assume each one is a separate object
            var spectra = [];
            for (var j = 0; j < exts_with_data.length; j++) {
                spectra.push(this.parseSingleExtensionFitsFile(exts_with_data[j]));
            }
            console.log('^^^ Returned spectra are: ^^^');
            console.log(spectra);
            q.resolve(spectra);
            return;
        }

        // If we've hit this point, we have a true multi-extenstion spectra,
        // with different data products in each spectrum
        // Added complication - the main file type which does this (AAOmega)
        // has 400 spectra in each data extension which will need to be
        // matched up
        // Also need to find any non-science spectra (calibrators?)

        // Look to identify which data extension(s) have intensity data in them
        // We assume anything with an 'OBJECT' keyword is describing real data
        // Or, any header labelled with '*INTENS*'
        let exts_with_int = [];
        exts_with_data.forEach(function (item, index) {
            if (
                (this.readHeaderValue(item, "OBJECT", undefined) !== undefined) ||
                (this.readHeaderValue(item, "EXTNAME", "").match(/intens/i))
            ) {
                exts_with_int.push(item);
            }
        }.bind(this));

        // First, throw an error at this point if there is more than one intensity
        // extension - such a file is too complex for generic read-in
        if (exts_with_int.length > 1) {
            console.log("&&& PROMISE REJECTED && - There are multiple intensity extensions in a file with different data products in each extension");
            q.reject("There are multiple intensity extensions in a file with different data products in each extension");
            return;
        } else if (exts_with_int.length === 0) {
            console.log("&&& PROMISE REJECTED && - Unable to find the data extension containing the intensities");
            q.reject("Unable to find the data extension containing the intensities");
            return;
        }

        // Find the remaining extensions of interest
        var var_ext_found = false;
        var var_ext;
        for (var i = 0; i < this.numExtensions; i++) {
            if (this.readHeaderValue(i, "EXTNAME", "").match(/var/i)) {
                var_ext_found = true;
                var_ext = i;
                break;
            }
        }

        var sky_ext_found = false;
        var sky_ext;
        for (var i = 0; i < this.numExtensions; i++) {
            if (this.readHeaderValue(i, "EXTNAME", "").match(/sky/i)) {
                sky_ext_found = true;
                sky_ext = i;
                break;
            }
        }

        // Specify the read-in functions
        let wavlReadFunc, instReadFunc, varReadFunc, skyReadFunc, detailReadFunc, wavlUnitReadFunc, intUnitReadFunc;

        // Need the number of points in case wavelength isnt an array but defined in the headers
        this.numPoints = this.fits.getHDU(exts_with_int[0]).data.width;

        // Specify the read functions
        // Note that the getIntensitySpect function can be re-used where information is structured similarly
        // to the intensity data
        instReadFunc = v => this.getIntensitySpect(v);
        varReadFunc = v => this.getIntensitySpect(v);
        wavlReadFunc = v => this.getWavelengthsSpect(v);
        wavlUnitReadFunc = v => this.getWavelengthUnitSpect(v);
        skyReadFunc = v => this.getIntensitySpect(v);

        $q.all([
            wavlReadFunc(exts_with_int[0]),
            instReadFunc(exts_with_int[0]),
            wavlUnitReadFunc(exts_with_int[0]),
            varReadFunc(var_ext),
            skyReadFunc(sky_ext)
        ]).then(function (data) {
            const wavelengths = data[0];
            const intensity = data[1];
            const wavelength_unit = data[2];
            const variances = data[3];
            const sky = data[4];

            let spectra = [];
            console.log("^^^ Forming return JSON objects ^^^");
            for (let s=0; s < intensity.length; s++) {
                // Check for actual intensities

                if (!this.useSpectra(intensity[s])) {
                    continue;
                }
                console.log("^^^ -- Forming object "+s+" ^^^");
                let spec;
                if (wavelengths.length === 1) {
                    spec = new Spectra(
                        {id: s,
                            wavelength: wavelengths[0],
                            intensity: intensity[s],
                            wavelength_unit: wavelength_unit,
                            variance: variances[s],
                            sky: sky[s]});
                } else if (wavelengths.length === intensity.length) {
                    spec = new Spectra(
                        {id: s,
                            wavelength: wavelengths[s],
                            intensity: intensity[s],
                            wavelength_unit: wavelength_unit,
                            variance: variances[s],
                            sky: sky[s]});
                } else {
                    q.reject("Wavelength and spectrum have different lengths - don't know how to match them up")
                }
                spectra.push(spec)
            }

            // Note that the calling function resolves the promise, not this one
            console.log('^^^ Returned spectra are: ^^^');
            console.log(spectra);
            q.resolve(spectra);

        }.bind(this), function () {
            console.error('!!! parseMultiExtensionFitsFile promise chain failed !!!');
            console.error(data);
        });



        // Re-check the 'properties' information in case more relevant information
        // is contained in the data extension header
//        var spectrum = {
//            "properties": {}
//        }

        //
    }

    parseHERMESFitsFile(q) {
        console.log("Parsing a file from the GALAH survey");

        // HERMES-2dF files have extra data extensions containing notionally uninteresting information
        // (sigma, spectrum w/out sky subtraction etc), BUT all those extensions use the OBJECT keyword,
        // so the file can't read by the standard multi-extension reader (which uses OBJECT to determine
        // which extension is the intensity plane

        $q.all([
            this.getWavelengthsSpect(0, 1),
            this.getIntensitySpect(0),
            this.getWavelengthUnitSpect(0, 1)
        ]).then(function (data) {
            const wavelengths = data[0];
            const ints = data[1];
            const wavelength_unit = data[2];
            let spec;
            spec = new Spectra({
                id: 1001,
                intensity: ints[0],
                wavelength: wavelengths[0],
                wavelength_unit: wavelength_unit
            });
            console.log('Wavelengths:');
            console.log(wavelengths);

            let spectra = [];
            spectra.push(spec);

            console.log('^^^ Returned spectra are: ^^^');
            console.log(spectra);
            q.resolve(spectra);

        }.bind(this), function () {
            console.error('!!! parseHERMESFitsFile promise chain failed !!!');
            console.error(data);
        });

    }

    parseSDSSFitsFile(q) {
        console.log("Parsing a file from SDSS. Using the DR12+ lite data standard.");
        console.log("See https://data.sdss.org/sas/dr16/eboss/spectro/redux/v5_13_0/spectra/lite/10000/spec-10000-57346-0001.fits for an example fits file");
        // This file typically has two extensions, and the coadded data is in the second extension (BinaryTable)

        let spectrum_exts = [];
        // Identify the extensions with the data we want. The SDSS Fits have no EXTNAME cards
        spectrum_exts.push(this.fits.getHDU("COADD"));

        let promise_list = spectrum_exts.map(
            function(j) {
                const q2 = $q.defer();
                $q.all([
                    this.getIntensityTable(j),
                    this.getWavelengthUnitTable(j),
                    this.getWavelengthsTable(j),
                    this.getVarianceTable(j),
                    this.getSkyTable(j)
                ]).then(function (data) {
                    console.log(">>> I've made it inside the 'then' function for ext " + j);
                    let id = this.readHeaderValue(0,"THING_ID", 0);
                    let specs = data[0];
                    let wavlUnit = data[1];
                    let wavls = data[2][0];
                    console.log(">>> Read in data");
                    console.log(data);

                    let intensity = specs[0];
                    let variance = data[3][0];
                    let sky = data[4][0];
                    console.log(">>> Unpacked the data");
                    let spec = new Spectra({
                        id: id,
                        intensity: intensity,
                        variance: variance,
                        wavelength: wavls,
                        wavelength_unit: wavlUnit,
                        sky: sky,
                    });
                    console.log(">>> Created the Spectra object");
                    console.log(">>> Completed read for extension " + j + "; spectra are:");
                    console.log(spec);
                    q2.resolve(spec);
                }.bind(this), function () {
                    console.error('!!! parse6dFGSFitsFile promise chain failed, on extension ' + j + ' !!!');
                    console.error(data);
                });
                return q2.promise;
            }.bind(this)
        );

        $q.all(promise_list).then(
            function (data) {
                console.log('%%% This is the then function for the master promise all');
                q.resolve(data);
            }
        ).catch(e => console.error(e));

    }

    parse6dFGSFitsFile(q) {
        console.log("Parsing a file from the 6dF Galaxy Survey");

        // These files have an interesting structure, being:
        // - There are three spectra - V, R and VR-combined
        // - Each of those spectra has an intensity, variance, sky, wavelength (VR only)
        // For repeat observations, the V/R/VR-combined sequence may be repeated

        // Unfortunately, the headers do no describe the above structure adequately to allow
        // the normal parsing functions to work, so we'll have to do the whole thing manually.

        // However, some of the files seem to follow a different HDU structure, namely:
        // IMAGE, INTENSITY, VARIANCE, SKY, WAVELENGTH
        // So, if we find the INTENSITY extension, we can hand over to parseMultiExtensionFitsFile

        let spectrum_exts = [];
        // Identify the extensions with the data we want
        for (var i = 0; i < this.numExtensions; i++) {
            var extname = this.readHeaderValue(i, 'EXTNAME', "");
            if (extname.match(/spectrum/i)){
                spectrum_exts.push(i);
            } else if (extname.match(/intensity/i)) {
                this.parseMultiExtensionFitsFile(q)[0];
            }
        }
        console.log("Found spectrum extensions " + spectrum_exts);

        let promise_list = spectrum_exts.map(
            function(j) {
                const q2 = $q.defer();
                $q.all([
                    this.getIntensitySpect(j, 0),
                    this.getWavelengthUnitSpect(j, 0),
                    this.getWavelengthsSpect(j, 0)
                ]).then(function (data) {
                    console.log(">>> I've made it inside the 'then' function for ext " + j);

                    let specs = data[0];
                    let wavlUnit = data[1];
                    let wavls = data[2][0];
                    console.log(">>> Read in data");
                    console.log(data);

                    let intensity = specs[0];
                    let variance = specs[1];
                    let sky = specs[2];
                    if (specs.length === 4) {
                        wavls = specs[3];
                    }
                    console.log(">>> Unpacked the data");
                    let spec = new Spectra({
                        id: j,
                        intensity: intensity,
                        variance: variance,
                        wavelength: wavls,
                        wavelength_unit: wavlUnit,
                        sky: sky,
                    });
                    console.log(">>> Created the Spectra object");
                    console.log(">>> Completed read for extension " + j + "; spectra are:");
                    console.log(spec);
                    q2.resolve(spec);
                }.bind(this), function () {
                    console.error('!!! parse6dFGSFitsFile promise chain failed, on extension ' + j + ' !!!');
                    console.error(data);
                });
                return q2.promise;
            }.bind(this)
        );

        $q.all(promise_list).then(
            function (data) {
                console.log('%%% This is the then function for the master promise all');
                q.resolve(data);
            }
        ).catch(e => console.error(e));
    }

    /**
     * Issues with some spectra containing almost all NaN values means I now check
     * each spectra before redshifting. This is a simple check at the moment,
     * but it can be extended if needed.
     *
     * Currently, if 90% or more of spectra values are NaN, throw it out. Realistically,
     * I could make this limit much lower.
     *
     * @param intensity
     * @returns {boolean}
     */
    useSpectra(intensity) {
        let c = 0;
        for (let i = 0; i < intensity.length; i++) {
            if (isNaN(intensity[i])) {
                c += 1;
            }
        }
        return c <= 0.9 * intensity.length;
    };
}

export default FitsFileLoader;