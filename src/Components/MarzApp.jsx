import * as React from "react";
import Header from "./Header";
import Overview from "./Pages/Overview";
import Sidebar from "./Sidebar";
import {MemoryRouter, BrowserRouter, Route} from "react-router-dom";
import Usage from "./Pages/Usage";
import Footer from "./Footer";
import Detailed from "./Pages/Detailed";
import {storeReady} from "../Stores/StoreUtils";
import Settings from "./Pages/Settings";
import Templates from "./Pages/Templates";
import {isSmall} from "../Utils/dry_helpers";
import {templateManager} from "../Lib/TemplateManager";
import {KeyBindings} from "./KeyBindings";


const Router = process.env.NODE_ENV === 'development' ? BrowserRouter : MemoryRouter;

// Enable the one shot store ready event trigger
let loaded = false;

function MarzApp(props) {
    // If this is the first time that the main application is rendered, also trigger a store ready event
    if (!loaded) {
        // Make sure this is a one shot event
        loaded = true;

        // Wait for the render to complete then call the store ready event
        setTimeout(() => {
            templateManager.initialise();   // This is a good place since we will have "window" and no workers will have started yet
            storeReady()
        }, 0)
    }

    return (
        <Router>
            <Route render={(routeProps) => (
                <div>
                    {
                        window.marz_configuration.layout == 'MarzSpectrumView' ?
                        (
                            <div>
                                <KeyBindings {...props} {...routeProps}/>
                                <Header {...props}/>
                            </div>
                        ) : null
                    }
                    <div id="underNavContainer">
                        {
                            (window.marz_configuration.layout == 'MarzSpectrumView') ?
                            (
                                <div className={"sidebar" + (isSmall({...props, ...routeProps}) ? " sidebarSmall" : "")}>
                                    <Sidebar {...props} {...routeProps}/>
                                </div>
                            ) : null
                        }
                        {
                        window.marz_configuration.layout == 'MarzSpectrumView' ?
                        (
                            <div className={"afterSideBarContainer" + (isSmall({...props, ...routeProps}) ? " sidebarSmall" : "")}>
                                <div className="spacing relative">
                                    <Route path="/marz/" render={(routeProps) => <Overview {...props} {...routeProps}/>}/>
                                    <Route path="/marz/usage/" render={(routeProps) => <Usage {...props} {...routeProps}/>}/>
                                    <Route path="/marz/detailed/"
                                        render={(routeProps) => <Detailed {...props} {...routeProps}/>}/>
                                    <Route path="/marz/settings/"
                                        render={(routeProps) => <Settings {...props} {...routeProps}/>}/>
                                    <Route path="/marz/templates/"
                                        render={(routeProps) => <Templates {...props} {...routeProps}/>}/>
                                </div>
                            </div>
                        ) : 
                        (
                            <div className="afterSideBarContainer readOnlySpectraContainer">
                                <div className="spacing relative">
                                    <Route path="/marz/"
                                        render={(routeProps) => <Detailed {...props} {...routeProps}/>}/>
                                </div>
                            </div>
                        ) 
                    }
                    </div>
                    {
                        window.marz_configuration.layout == 'MarzSpectrumView' ?
                        (
                            <Footer {...props}/>
                        ) : null
                    }
                    
                </div>
            )}/>
        </Router>
    )
}

export default MarzApp;
