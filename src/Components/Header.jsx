import * as React from "react";
import {Collapse, Form, FormGroup, Input, Nav, Navbar, NavbarToggler, NavItem} from "reactstrap";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {Link} from "react-router-dom";

import marzIcon from '../Assets/images/Marz.png';
import {faCog, faQuestionCircle, faSignal, faTasks, faTh} from "@fortawesome/free-solid-svg-icons";
import {updateInitials} from "../Stores/Personal/Actions";
import BibTeX from "./BibTeX";
import Progress from "reactstrap/es/Progress";
import * as Enumerable from "linq";

class Header extends React.Component {
    constructor(props) {
        super(props);

        this.toggle = this.toggle.bind(this);

        // Set the initial state of the menu as closed
        this.state = {
            isOpen: false
        };
    }

    toggle() {
        // Toggle the open state of the menu
        this.setState({
            isOpen: !this.state.isOpen
        });
    }

    render() {
        return (
            <Navbar color="dark" dark expand="md" fixed="top" className="marz-header">
                <Link className="navbar-brand" to="/marz/">
                    <img className='navbar-brand-logo' src={marzIcon} alt="Marz Logo"/>
                </Link>
                <NavbarToggler onClick={this.toggle}/>
                <Collapse isOpen={this.state.isOpen} navbar>
                    <Nav className="ml-auto" navbar>
                        <NavItem>
                            <Link className="nav-link" to="/marz/"><FontAwesomeIcon icon={faTh}/> Overview</Link>
                        </NavItem>
                        <NavItem>
                            <Link className="nav-link" to="/marz/detailed/"><FontAwesomeIcon icon={faSignal}/> Detailed</Link>
                        </NavItem>
                        <NavItem>
                            <Link className="nav-link" to="/marz/templates/"><FontAwesomeIcon icon={faTasks}/> Templates</Link>
                        </NavItem>
                        <NavItem>
                            <Link className="nav-link" to="/marz/settings/"><FontAwesomeIcon icon={faCog}/> Settings</Link>
                        </NavItem>
                        <NavItem>
                            <Link className="nav-link" to="/marz/usage/"><FontAwesomeIcon icon={faQuestionCircle}/> Usage</Link>
                        </NavItem>
                    </Nav>
                    {
                        this.props.ui.quality.max > 0 ? (
                            <div className="navbar-form navbar-left file-completion">
                                <p className="navbar-progress-text">File completion:</p>
                                <div className="navbar-progress">
                                <Progress multi>
                                    {
                                        Enumerable.from(this.props.ui.quality.bars).select((e, i) => (
                                            <Progress
                                                striped value={e.value}
                                                color={e.type}
                                                key={i}
                                                max={this.props.ui.quality.max}
                                                bar
                                            >
                                                {e.label > 3 ? (<span>{e.label}</span>) : null}
                                            </Progress>
                                        )).toArray()
                                    }
                                </Progress>
                                </div>
                            </div>
                        ) : null
                    }
                    <Form className="ml-auto" inline>
                        <FormGroup>
                            <BibTeX/>
                            <Input className="initials-input" defaultValue={this.props.personal.initials} bsSize="sm" type="text" placeholder="Enter initials" onChange={e => updateInitials(e.target.value)}/>
                        </FormGroup>
                    </Form>
                </Collapse>
            </Navbar>
        )
    }
}

export default Header;
