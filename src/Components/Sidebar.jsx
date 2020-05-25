import React from "react";
import Dropzone from "react-dropzone";

import styled from 'styled-components';
import {addFiles} from "../Stores/Data/Actions";
import {Button, ButtonGroup} from "reactstrap";
import {saveManual, setActive, setGraphicalLayout, setOnlyQOP0, toggleSmallSidebar, selectReadOnlyView, selectSimpleView, selectOverlayView} from "../Stores/UI/Actions";
import {isDetailed, isOverview, isSmall} from "../Utils/dry_helpers";
import ManagedButtonGroup from "./General/ManagedButtonGroup/ManagedButtonGroup";
import * as Enumerable from "linq";
import {setFilterQOP, setFilterRedshift, setFilterTemplate, setFilterType} from "../Stores/Sidebar/Actions";

const getColor = (props) => {
    if (props.isDragReject) {
        return '#c66';
    }
    if (props.isDragActive) {
        return '#5E99FF';
    }
    return '#bbb';
};

const Container = styled.div`
  padding: 10px;
  width: 100%;
  border-width: 4px;
  border-radius: 5px;
  border-color: ${props => getColor(props)};
  border-style: ${props => props.isDragReject || props.isDragActive ? 'solid' : 'dashed'};
  background-color: ${props => props.isDragReject || props.isDragActive ? '#eee' : ''};
  text-align: center;
`;

class Sidebar extends React.Component {
    constructor(props) {
        super(props);

        this.onDrop.bind(this)
    }

    onDrop(acceptedFiles, rejectedFiles) {
        // Do something with files
        addFiles(acceptedFiles);
    }

    getContractButtonLabel() {
        return this.props.ui.sidebarSmall ? ">>" : "Contract sidebar";
    };

    isWaitingDrop() {
        // If there is no spectra loaded, we are waiting for a file drop
        return !this.props.data.processorService.spectraManager.hasSpectra();
    };

    getTitle() {
        // Get the current title for the loaded fits file
        return this.props.data.fitsFileName;
    }

    getButtonLabel(qop) {
        const labels = {4: ['Great (4)', '4'], 3: ['Good (3)', '3'], 2: ['Possible (2)', '2'], 1: ['Unknown (1)', '1'], 6: ['It\'s a star! (6)', '6'], 0: ['Unassigned (0)', '0']};
        return labels[qop][this.props.ui.sidebarSmall ? 1 : 0]
    };

    getButtonTooltip(qop) {
        const labels = {4: ['Great (4)', '4'], 3: ['Good (3)', '3'], 2: ['Possible (2)', '2'], 1: ['Unknown (1)', '1'], 6: ['It\'s a star! (6)', '6'], 0: ['Unassigned (0)', '0']};
        return labels[qop][0]
    };

    getAnalysedText(spectra) {
        if (spectra.hasRedshift()) {
            return "z = " + spectra.getFinalRedshift().toFixed(5);
        } else {
            return "Not analysed";
        }
    };

    render() {
        return (
            <div className="filler light-grey-background">
                <div className="spacing sidebar-spectra-container">
                    <div id="sidebar-wrapper">
                        {/* Render the file dropper */}
                        {!isSmall(this.props) ? (
                            <Dropzone onDrop={this.onDrop}>
                                {({getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject, acceptedFiles}) => {
                                    return (
                                        <Container
                                            isDragActive={isDragActive}
                                            isDragReject={isDragReject}
                                            {...getRootProps()}
                                        >
                                            <input {...getInputProps()} />
                                            {this.isWaitingDrop() ? (
                                                <h4 className="file-drop-h5">{isDragAccept ? 'Drop' : 'Drag'} a FITs
                                                    file or
                                                    a
                                                    results file. Or drop a results file and THEN a FITs file.</h4>
                                            ) : (
                                                <h4 className="file-drop-h5 capitalise">
                                                    {this.getTitle()}
                                                </h4>
                                            )}
                                            <span className="btn btn-light btn-file">
                                            Browse <input {...getInputProps()}/>
                                        </span>
                                        </Container>
                                    )
                                }}
                            </Dropzone>) : null
                        }

                        {/* Render the contract sidebar button if we're on the detailed page*/}
                        {isDetailed(this.props) ? (
                            <div className="top-spacing">
                                <Button block color="light" size="sm" onClick={() => toggleSmallSidebar()}>
                                    {this.getContractButtonLabel()}
                                </Button>
                        </div>) : null
                        }

                        {/* Render the default redshift selection */}
                        {/*<p>TODO: Merge Redshifter</p>*/}
                        {this.props.ui.merge && !this.props.ui.sidebarSmall ? (
                            <div className="top-spacing">
                                <b>Default Redshifter:</b>
                                <ManagedButtonGroup
                                    className="d-flex"
                                >
                                    {Enumerable.from(this.props.ui.mergeInitials).select(e => {
                                        return (
                                            <Button>

                                            </Button>
                                        )
                                    }).toArray()}
                                </ManagedButtonGroup>
                            </div>
                        ) : null}
                        {/* Render the Graph/Table buttons if we're on the overview page */}
                        {isOverview(this.props) ? (
                            <div className="top-spacing">
                                <b>Display Data As:</b>
                                <ManagedButtonGroup
                                    className="d-flex"
                                    onChange={v => setGraphicalLayout(v)}
                                    value={this.props.ui.graphicalLayout}
                                >
                                    <Button color="light" className="w-100" value={true}>
                                        Graph
                                    </Button>
                                    <Button color="light" className="w-100" value={false}>
                                        Table
                                    </Button>
                                </ManagedButtonGroup>
                            </div>) : null
                        }

                        {/* Render the Spectra filters if we're on the overview page */}
                        {isOverview(this.props) ? (
                            <div className="top-spacing">
                                <b>Filter Spectra:</b>
                                <select
                                    className="input-sm form-control"
                                    required
                                    value={this.props.sidebar.filters.typeFilter}
                                    onChange={e => setFilterType(e.target.value)}
                                >
                                    {
                                        Enumerable.from(this.props.sidebar.types).select(e => {
                                            return (<option value={e.value} key={e.value}>{e.label}</option>)
                                        }).toArray()
                                    }
                                </select>
                                <select
                                    className="input-sm form-control"
                                    required
                                    value={this.props.sidebar.filters.templateFilter}
                                    onChange={e => setFilterTemplate(e.target.value)}
                                >
                                    {
                                        Enumerable.from(this.props.sidebar.temps).select(e => {
                                            return (<option value={e.value} key={e.value}>{e.label}</option>)
                                        }).toArray()
                                    }
                                </select>
                                <select
                                    className="input-sm form-control"
                                    required
                                    value={this.props.sidebar.filters.redshiftFilter}
                                    onChange={e => setFilterRedshift(e.target.value)}
                                >
                                    {
                                        Enumerable.from(this.props.sidebar.redshifts).select(e => {
                                            return (<option value={e.value} key={e.value}>{e.label}</option>)
                                        }).toArray()
                                    }
                                </select>
                                <select
                                    className="input-sm form-control"
                                    required
                                    value={this.props.sidebar.filters.qopFilter}
                                    onChange={e => setFilterQOP(e.target.value)}
                                >
                                    {
                                        Enumerable.from(this.props.sidebar.qops).select(e => {
                                            return (<option value={e.value} key={e.value}>{e.label}</option>)
                                        }).toArray()
                                    }
                                </select>
                            </div>) : null
                        }
                    </div>
                    {
                        isDetailed(this.props) && !this.props.ui.sidebarSmall ? (
                            <div className="top-spacing">
                                <b>Save QOP:</b>
                                <Button size="sm" block color="success" onClick={() => saveManual(4)}>{this.getButtonLabel(4)}</Button>
                                <Button size="sm" block color="info" onClick={() => saveManual(3)}>{this.getButtonLabel(3)}</Button>
                                <Button size="sm" block color="warning" onClick={() => saveManual(2)}>{this.getButtonLabel(2)}</Button>
                                <Button size="sm" block color="danger" onClick={() => saveManual(1)}>{this.getButtonLabel(1)}</Button>
                                <Button size="sm" block color="primary" onClick={() => saveManual(6)}>{this.getButtonLabel(6)}</Button>
                                <Button size="sm" block color="default" onClick={() => saveManual(0)}>{this.getButtonLabel(0)}</Button>
                            </div>
                        ) : null
                    }
                    {
                        isDetailed(this.props) && this.props.ui.sidebarSmall ? (
                            <div className="top-spacing">
                                <b>Save QOP:</b>
                                <Button size="sm" data-toggle="tooltip" title={this.getButtonTooltip(4)} block color="success" onClick={() => saveManual(4)}>{this.getButtonLabel(4)}</Button>
                                <Button size="sm" data-toggle="tooltip" title={this.getButtonTooltip(3)} block color="info" onClick={() => saveManual(3)}>{this.getButtonLabel(3)}</Button>
                                <Button size="sm" data-toggle="tooltip" title={this.getButtonTooltip(2)} block color="warning" onClick={() => saveManual(2)}>{this.getButtonLabel(2)}</Button>
                                <Button size="sm" data-toggle="tooltip" title={this.getButtonTooltip(1)} block color="danger" onClick={() => saveManual(1)}>{this.getButtonLabel(1)}</Button>
                                <Button size="sm" data-toggle="tooltip" title={this.getButtonTooltip(6)} block color="primary" onClick={() => saveManual(6)}>{this.getButtonLabel(6)}</Button>
                                <Button size="sm" data-toggle="tooltip" title={this.getButtonTooltip(0)} block color="default" onClick={() => saveManual(0)}>{this.getButtonLabel(0)}</Button>
                            </div>
                        ) : null
                    }
                    {
                        !isDetailed(this.props) || !this.props.ui.sidebarSmall ? (
                            <div className="top-spacing">
                                <b>Stepping options:</b>
                                <div className="checkbox checkbox-info checkbox-circle">
                                    <input type="checkbox" id="checkbox1" checked={this.props.ui.detailed.onlyQOP0} onChange={e => setOnlyQOP0(e.target.checked)}/>
                                    <label>
                                        QOP 0 only
                                    </label>
                                </div>
                            </div>
                        ) : null
                    }
                    {
                        !isDetailed(this.props) || !this.props.ui.sidebarSmall ? (
                            <div id="sidebar-list" className="top-spacing lined sidebar-spectra-list">
                                {
                                    Enumerable.from(this.props.data.spectra).select((e, i) => {
                                        return (
                                            <div
                                                className={"left-padding-small spectra-list-item " + ((i % 2 === 0) ? "darker " : "") + (this.props.ui.active === e ? "activeSelect" : "")}
                                                key={e.id}
                                                onClick={() => this.props.data.processorService.spectraManager.setActive(e)}
                                                onDoubleClick={() => {
                                                    this.props.data.processorService.spectraManager.setActive(e);
                                                    this.props.history.push('/marz/detailed/')
                                                }}
                                            >
                                                <p>
                                                    <strong className="right-padding-small">
                                                        {e.id}
                                                    </strong>
                                                    {this.getAnalysedText(e)}
                                                    {e.hasRedshift() ? (
                                                        <span className={"float-right badge " + e.qopLabel}>{e.qop}</span>
                                                    ) : null}
                                                </p>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        ) : null
                    }
                </div>
            </div>
        )
    }
}

export default Sidebar
