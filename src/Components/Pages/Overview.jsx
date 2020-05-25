import * as React from "react";
import {Badge, Col, Container, Row} from "reactstrap";
import {Link} from "react-router-dom";
import BootstrapTable from 'react-bootstrap-table-next';

import marzIcon from '../../Assets/images/Marz2.png';
import * as Enumerable from "linq";
import {templateManager} from "../../Lib/TemplateManager";
import {getRemoteFile} from "../../Utils/dry_helpers";
import {addFiles} from "../../Stores/Data/Actions";

class Overview extends React.Component {
    constructor(props) {
        super(props);
    }

    getName(spectra) {
        if (spectra.getFinalTemplateID()) {
            return templateManager.getNameForTemplate(spectra.getFinalTemplateID());
        } else {
            return "";
        }
    };

    componentDidMount() {
        let remote_file=getRemoteFile(this.props.location.search);
        console.log("Overview remote_file=",remote_file);
        if (remote_file!=null) {
            let files=[];
            files.push({name:remote_file, isurl: true});
            addFiles(files);
        } else if ("remote_file" in window.marz_configuration) {
            if (window.marz_configuration.remote_file !== null) {
                console.log("ADD REMOTE FILE ",window.marz_configuration.remote_file);
                let files=[];
                files.push({name:window.marz_configuration.remote_file, isurl: true});
                addFiles(files);
            }
        }
    }

    render() {
        // Check if we're loading a file currently
        if (this.props.data.fitsFileLoader.isLoading)
            return (
                <div className="spinner"/>
            );

        if (!this.props.data.fitsFileLoader.isLoading) {
            if (!this.props.data.fitsFileName) {
                return (
                    <Container className="usage marketing">
                        <h1 className="center-block welcomeText">
                            Welcome to
                            <img src={marzIcon} width="260" alt="Marz: Manual and Assisted Redshifting"/>
                        </h1>

                        <Row>
                            <Col xs={4} className="introCard">
                                <div className="inner">
                                    <h2>New users</h2>
                                    <p>Please visit the <Link to="/usage/">usage page</Link>. It contains instructions,
                                        example
                                        FITS files, and useful Python code to import results!</p>
                                    <p>If you use Marz, please cite this work via the BibTeX available when clicking the
                                        blue
                                        button above. If you want to use high resolution graphs, the download arrow icon
                                        in the
                                        upper right corner of the plot in the Detailed view is what you want!</p>
                                    <p>
                                        <a target="_blank"
                                           href="https://github.com/Samreay/Marz/releases/download/0.2.0/alldata_combined_runz_x12_b02.fits">
                                            Click here if you want an example FITS file straight away!
                                        </a>
                                    </p>
                                </div>
                            </Col>
                            <Col xs={4} className="introCard">
                                <div className="inner">
                                    <h2>Returning users</h2>
                                    <p>
                                        You know the deal, drop in a FITS file and have fun. If you can think of any
                                        feature
                                        that would make your life easier, simply&nbsp;
                                        <a target="_blank" href="https://github.com/samreay/Marz/issues">
                                            raise a Github issue
                                        </a>
                                        , and I'll jump on it as soon as possible! The more detail and
                                        screenshots, the better!
                                    </p>
                                    <p>
                                        If you want to merge results, drag the FITS file and 2 <code>.mz</code> files in
                                        all
                                        at once.
                                    </p>
                                </div>
                            </Col>
                            <Col xs={4} className="introCard">
                                <div className="inner">
                                    <h2>The technically minded</h2>
                                    <p>
                                        Instructions for command line usage, running your own Marz server, licensing
                                        details and
                                        version history can all be found in the&nbsp;
                                        <a target="_blank" href="https://github.com/Samreay/Marz">
                                            main README.md on Github.
                                        </a>
                                    </p>
                                    <p>
                                        Formal documentation can be found&nbsp;
                                        <a target="_blank"
                                           href="http://www.sciencedirect.com/science/article/pii/S2213133716300166">
                                            here,
                                        </a>
                                        &nbsp;or on&nbsp;
                                        <a target="_blank" href="http://arxiv.org/abs/1603.09438">
                                            arXiv
                                        </a>
                                    </p>
                                </div>
                            </Col>
                        </Row>
                    </Container>
                )
            }
            if (!this.props.ui.graphicalLayout && this.props.data.fitsFileName) {
                const products = Enumerable.from(this.props.data.spectra).select(s => {
                    return {
                        id: s.id,
                        type: s.type,
                        templateId: s.getFinalTemplateID(),
                        template: this.getName(s),
                        redshift: s.getFinalRedshift() ? s.getFinalRedshift().toFixed(5) : null,
                        qop: (<h5><Badge className={s.qopLabel}>{s.qop}</Badge></h5>)
                    }
                }).toArray();
                const columns = [
                    {
                        dataField: 'id',
                        text: 'ID',
                        sort: true
                    },
                    {
                        dataField: 'type',
                        text: 'Type',
                        sort: true
                    },
                    {
                        dataField: 'templateId',
                        text: 'Template ID',
                        sort: true
                    },
                    {
                        dataField: 'template',
                        text: 'Template',
                        sort: true
                    },
                    {
                        dataField: 'redshift',
                        text: 'Redshift',
                        sort: true
                    },
                    {
                        dataField: 'qop',
                        text: 'QOP',
                        sort: true
                    }
                ];

                const rowEvents = {
                    onDoubleClick: (e, row, rowIndex) => {
                        this.props.data.processorService.spectraManager.setActive(Enumerable.from(this.props.data.spectra).first(e => e.id === row.id));
                        this.props.history.push('/marz/detailed/')
                    }
                };

                const selectRow = {
                    mode: 'radio',
                    clickToSelect: true,
                    bgColor: '#D3DFF5',
                    onSelect: (row, isSelect) => {
                        this.props.data.processorService.spectraManager.setActive(Enumerable.from(this.props.data.spectra).first(e => e.id === row.id));
                    },
                    selected: [this.props.ui.active.id]
                };

                return (
                    <BootstrapTable
                        bootstrap4
                        keyField='id'
                        data={products}
                        columns={columns}
                        condensed
                        rowEvents={rowEvents}
                        selectRow={selectRow}
                        hover
                    />
                )
            }
        }

        return (
            <div className="overview2">
                {
                    Enumerable.from(this.props.data.spectra).where(e => {
                        const f = this.props.sidebar.filters;
                        const q = parseInt(f.qopFilter);
                        const r = f.redshiftFilter.split(':');

                        if (f.typeFilter !== '*' && e.type !== f.typeFilter) return false;
                        if (f.templateFilter !== '*' && e.getFinalTemplateID() !== f.templateFilter) return false;
                        if (f.redshiftFilter !== '*' && (e.getFinalRedshift() == null || !(e.getFinalRedshift() >= parseFloat(r[0]) && e.getFinalRedshift() <= parseFloat(r[1])))) return false;
                        return !(f.qopFilter !== '*' && e.qop !== q);
                    }).select(e => {
                        return (
                            <div className={"overview-item lined" + (this.props.ui.active.id === e.id ? " activeSelect" : "")}
                            onClick={() => this.props.data.processorService.spectraManager.setActive(e)}
                             onDoubleClick={() => {
                                 this.props.data.processorService.spectraManager.setActive(e);
                                 this.props.history.push('/detailed/')
                             }}
                                 key={e.id}
                             >
                                 {/*// ng-repeat="i in data.spectra | overviewFilter track by i.getHash()">*/}
                            <div className="top-bar">
                                <strong>ID: {e.id}</strong>
                                {
                                    e.hasRedshift() ? (
                                        <p>z={e.getFinalRedshift().toFixed(5)}</p>
                                    ) : null
                                }
                                <h4 className="inline">
                                    <span className={"float-right badge " +  e.qopLabel}>
                                        QOP: {e.qop}
                                    </span>
                                </h4>
                            </div>
                            <img className="under-bar unselectable" src={e.getImage(this.props.ui.colours)} />
                        </div>
                        )
                    }).toArray()
                }
            </div>
        )
    }
}

export default Overview
