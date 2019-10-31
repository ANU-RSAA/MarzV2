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
        // Convert the wavelength into one of the standard values, based on
        // what kind of variations there normally are
        if (wavlUnit.match(/ang/i) || wavlUnit.match(/aa/i)) {
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
            if (this.header0.cards[pkg["headerkw"]] === pkg["headervalue"]) {
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

    getWavelengthsSpect(ext) {
        this.log.debug('Getting spectra wavelengths');
        const q = $q.defer();

        const wavlAxisIndex = this.getWavelengthAxis(ext) + 1 ;  // Need to add one to come back to FITS indexing
        console.log("wavlAxis being used in getWavelengthSpect = " + wavlAxisIndex);

        const crval = this.readHeaderValue(ext, "CRVAL" + wavlAxisIndex) || this.readHeaderValue(ext, "CV1_" + wavlAxisIndex);
        const crpix = this.readHeaderValue(ext, "CRPIX" + wavlAxisIndex) || this.readHeaderValue(ext, "CP1_" + wavlAxisIndex);
        const cdelt = this.readHeaderValue(ext, "CDELT" + wavlAxisIndex) || this.readHeaderValue(ext, "CD1_" + wavlAxisIndex);
        const scale = this.readHeaderValue(ext, "LOGSCALE") || "F";
        const needShift = this.readHeaderValue(ext, "VACUUM") || "T";
        console.log("crval = " + crval + ", crpix = " + crpix + ", cdelt = " + cdelt);

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
                lambda.push(Math.pow(10, ((i + 1 - crpix) * cdelt) + crval));
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
        lambdas.push(lambda);
        q.resolve(lambdas);

        return q.promise;
    }

    getWavelengthsTable(ext) {
        const q = $q.defer();

        // Attempt to identify which table column the wavelength data are in
        const wavlTypeKW = [];
        const wavlColName = [];

        for (let headerkw in this.fits.getHeader(ext).cards) {
            try {
                if ((this.fits.getHeader(ext).cards[headerkw].value.indexOf("wave") !== -1 || this.fits.getHeader(ext).cards[headerkw].value.indexOf("lam") !== -1) && headerkw.indexOf("TYPE") !== -1) {
                    wavlTypeKW.push(headerkw);
                    wavlColName.push(this.fits.getHeader(ext).cards[headerkw].value);
                }
            } catch (TypeError) {}
        }

        if (wavlTypeKW.length !== 1) {
            console.log("&&& PROMISE REJECTED && - Unable to determine table column for wavelength");
            q.reject("Unable to determine table column for wavelength");
            return;
        }

        // Get the column index from the header keyword, by stripping off the
        // number at the end of the keyword
        // Need to subtract one because arrays in JavaScript are zero-indexed
        const wavColumnIndex = parseInt(wavlTypeKW[0][wavlTypeKW[0].length - 1]) - 1;

        // Extract the column data
        let col_data = [];
        this.fits.getDataUnit(ext).getColumn("wave", function (column) {
            col_data = column;
        });

        // If 'log' was in the row name, we need to convert to 'actual' values
        if (wavlColName[0].indexOf("log") !== -1) {
            for (let i = 0; i < col_data.length; i++) {
                col_data[i] = Math.pow(10, col_data[i]); // Just converting 'actual' values, no need to do e.g. deltas
            }
        }

        // Wavelength unit detection is done elsewhere
        q.resolve(col_data);

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


    getWavelengthUnitSpect(ext) {
        const q = $q.defer();

        let wavlUnit = null ;
        const wavlAxisIndex = this.getWavelengthAxis(ext) ;
        let foundWavlUnit = this.readHeaderValue(ext, "CUNIT" + wavlAxisIndex) || null ;

        if (foundWavlUnit == null) {
            wavlUnit = "pixel" ;
        }

        // Get the standard name for the wavl. unit
        wavlUnit = this.standardizeWavlUnit(wavlUnit);
        q.resolve(wavlUnit);
        return q.promise;

    }


    getIntensitySpect(ext) {
        const q = $q.defer();

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
            if (dataDims == 1) {
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
                var wavlAxis = this.getWavelengthAxis(ext);
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
            q.resolve(intensitySpects);
            return q.promise ;

        }.bind(this));

    }

    convertToSpectraObject(spectralist) {
        let speclist2 = [];
        for (let i = 0; i < spectralist.length; i++) {
            const s = new Spectra(i, spectralist[i][0], spectralist[i][1], null, null, "NAME", 0, 0, 23, "SOMETYPE", "UNKNOWN", 0, 0, false);
            s.setCompute(false);
            speclist2.push(s);
        }
        return speclist2;
    }

    parseSingleExtensionFitsFile(q, ext) {
        console.log("Parsing Single Extension Fits File");
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
            this.numPoints = this.fits.getHDU(1).data.rows;
            // Assign table read functions
            wavlReadFunc = v => this.getWavelengthsTable(v);
            // console.log('^^^ wavlReadFunc is: ^^^');
            // console.log(wavlReadFunc);
            instReadFunc = this.getIntensityTable;
//            varReadFunc = this.getVarianceTable;
//            skyReadFunc = this.getSkyTable;
//            detailReadFunc = this.getDetailTable;
            wavlUnitReadFunc = v => this.getWavelengthUnitTable(v);
//            instUnitReadFunc = v => this.getIntensityUnitTable(v);
        } else if (isLamost) {
            // Assign LAMOST read functions
        } else {
            this.numPoints = this.fits.getHDU(0).data.width;
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
            wavlReadFunc(0),
            instReadFunc(0),
//            varReadFunc(0),
//            skyReadFunc(0),
//            detailReadFunc(0),
            wavlUnitReadFunc(0),
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
            var s;
            for (s=0; s < ints.length; s++) {
                console.log("^^^ -- Forming object "+s+" ^^^");
                let spec = [wavls[s], ints[s], wavlUnit, ];
                spectra.push(spec)
            }

            // Note that the calling function resolves the promise, not this one
            console.log('^^^ Returned spectra are: ^^^');
            console.log(spectra);

            var converted_objects = this.convertToSpectraObject(spectra);
            q.resolve(converted_objects);

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
        for (i = 0; i < this.numExtensions; i++) {
            if (this.fits.getHDU(i).data !== undefined) {
                exts_with_data.push(i);
            }
        }

        if (exts_with_data.length === 1) {
            this.parseSingleExtensionFitsFile(q, exts_with_data[0]);
        }

        // OK, so there's multiple extensions with data. Now need to see if
        // it's one object per extension, or different products for the same
        // object
        // We do this by checking for an EXTNAME attribute on the data
        // extensions, and seeing if we can find a variance extension
        // (That is, does EXTNAME contain the string 'var'?)
        var var_ext_found = false;
        var var_ext;
        for (var i = 0; i < this.numExtensions; i++) {
            if (this.readHeaderValue(i, "EXTNAME", "").match(/var/i)) {
                var_ext_found = true;
                var_ext = i;
                break;
            }
        }
        if (!var_ext_found) {
            // Need to loop over the separate extensions in sequence, as we
            // assume each one is a separate object
            var spectra = [];
            for (var j = 0; j < exts_with_data.length; j++) {
                spectra.push(this.parseSingleExtensionFitsFile(exts_with_data[j]));

            }
        }

        // If we've hit this point, we have a true multi-extenstion spectra,
        // with different data products in each spectrum
        // Added complication - the main file type which does this (AAOmega)
        // has 400 spectra in each data extension which will need to be
        // matched up
        // Also need to find any non-science spectra (calibrators?)

        // Look to identify which data extension(s) have intensity data in them
        // We assume anything with an 'OBJECT' keyword is describing real data
        let exts_with_int = [];
        exts_with_data.forEach(function (item, index) {
            if (this.readHeaderValue(item, "OBJECT", undefined) !== undefined) {
                exts_with_int.push(item);
            }
        }.bind(this));

        // First, throw an error at this point if there is more than one intensity
        // extension - such a file is too complex for generic read-in
        if (exts_with_int.length > 1) {
            console.log("&&& PROMISE REJECTED && - There are multiple intensity extensions in a file with different data products in each extension");
            q.reject("There are multiple intensity extensions in a file with different data products in each extension");
            return;
        } else if (exts_with_int.length == 0) {
            console.log("&&& PROMISE REJECTED && - Unable to find the data extension containing the intensities");
            q.reject("Unable to find the data extension containing the intensities");
            return;
        }

        // Specify the read-in functions
        let wavlReadFunc, instReadFunc, varReadFunc, skyReadFunc, detailReadFunc, wavlUnitReadFunc, intUnitReadFunc;

        instReadFunc = v => this.getIntensitySpect(v);
        wavlReadFunc = v => this.getWavelengthsSpect(v);
        wavlUnitReadFunc = v => this.getWavelengthUnitSpect(v);

        $q.all([
            wavlReadFunc(exts_with_int[0]),
            instReadFunc(exts_with_int[0]),
            wavlUnitReadFunc(exts_with_int[0])
        ]).then(function (data) {
            console.log("^^^ Forming return JSON objects ^^^");
            var s;
            for (s=0; s < ints.length; s++) {
                console.log("^^^ -- Forming object "+s+" ^^^");
                let spec = [wavls[s], ints[s], wavlUnit, ];
                spectra.push(spec)
            }

            // Note that the calling function resolves the promise, not this one
            console.log('^^^ Returned spectra are: ^^^');
            console.log(spectra);

            var converted_objects = this.convertToSpectraObject(spectra);
            q.resolve(converted_objects);

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



}

export default FitsFileLoader;