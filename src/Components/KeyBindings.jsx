import * as React from "react";
import {spectraLineService} from "./General/DetailedCanvas/spectralLines";
import * as Enumerable from "linq";
import {
    acceptAutoQOP,
    clickSpectralLine,
    fitNow,
    nextMatchedDetails,
    nextSpectralLine,
    nextTemplate,
    previousSpectralLine,
    prevMatchedDetails, prevTemplate,
    resetToAutomatic,
    resetToManual,
    resetZoom,
    saveManual,
    setMatchedIndex,
    setSmooth,
    setTemplateMatched,
    toggleSpectralLines,
    updateRedShift
} from "../Stores/UI/Actions";
import * as keyboardJS from "keyboardjs";
import Store from "../Stores/Store"

let keybinds = null;

class KeyBindings extends React.Component {
    constructor(props) {
        super(props);

        this.addClickHandler = this.addClickHandler.bind(this);

        keybinds = [
            {
                key: 'shift+?',
                label: '?',
                description: 'Go to the Usage tab',
                fn: () => this.props.history.push('/marz/usage/')
            },
            {
                key: 'n',
                label: 'n',
                description: 'Selects the next spectra',
                fn: () => setTimeout(() => Store.getState().getData().processorService.spectraManager.setNextSpectra(), 0)
            },
            {
                key: 'b',
                label: 'b',
                description: 'Selects the previous spectra',
                fn: () => setTimeout(() => Store.getState().getData().processorService.spectraManager.setPreviousSpectra(), 0)
            },
            {
                key: 't',
                label: 't',
                description: 'Toggle whether templates are displayed',
                fn: () => setTimeout(() => setTemplateMatched(!this.props.ui.dataSelection.matched), 0)
            },
            {
                key: ['1', 'num1'],
                label: '1',
                description: '[Detailed screen] Save with manual QOP of 1',
                fn: () => setTimeout(() => saveManual(1))
            },
            {
                key: ['2', 'num2'],
                label: '2',
                description: '[Detailed screen] Save with manual QOP of 2',
                fn: () => setTimeout(() => saveManual(2))
            },
            {
                key: ['3', 'num3'],
                label: '3',
                description: '[Detailed screen] Save with manual QOP of 3',
                fn: () => setTimeout(() => saveManual(3))
            },
            {
                key: ['4', 'num4'],
                label: '4',
                description: '[Detailed screen] Save with manual QOP of 4',
                fn: () => setTimeout(() => saveManual(4))
            },
            {
                key: ['6', 'num6'],
                label: '6',
                description: '[Detailed screen] Save with manual QOP of 6',
                fn: () => setTimeout(() => saveManual(6))
            },
            {
                key: ['0', 'num0'],
                label: '0',
                description: '[Detailed screen] Save with manual QOP of 0',
                fn: () => setTimeout(() => saveManual(0))
            },
            {
                key: 'z',
                label: 'z',
                description: '[Detailed screen] Focus on redshift input',
                fn: (e) => setTimeout(() => {
                    document.getElementById("#redshiftInput").focus();
                    e.preventDefault();
                }, 0)
            },
            {
                key: 'm',
                label: 'm',
                description: '[Detailed screen] Set view to manually found redshift',
                fn: () => setTimeout(() => resetToManual(), 0)
            },
            {
                key: 'shift+r',
                label: 'shift+r',
                description: '[Detailed screen] Set view to automatically found redshift',
                fn: () => setTimeout(() => resetToAutomatic(), 0)
            },
            {
                key: 'o',
                label: 'o',
                controller: "detailed",
                description: '[Detailed screen] Show the next automatic redshift result',
                fn: () => setTimeout(() => nextMatchedDetails(), 0)
            },
            {
                key: 'i',
                label: 'i',
                description: '[Detailed screen] Show the previous automatic redshift result',
                fn: () => setTimeout(() => prevMatchedDetails(), 0)
            },
            {
                key: 'u',
                label: 'u',
                controller: "detailed",
                description: '[Detailed screen] Fit the result within a localised window',
                fn: () => setTimeout(() => fitNow())
            },
            {
                key: 's',
                label: 's',
                description: '[Detailed screen] Increase smoothing level',
                fn: () => setTimeout(() => setSmooth(this.props.ui.detailed.bounds.maxSmooth+1))
            },
            {
                key: 'd',
                label: 'd',
                description: '[Detailed screen] Decrease smoothing level',
                fn: () => setTimeout(() => setSmooth(this.props.ui.detailed.bounds.maxSmooth-1))
            },
            {
                key: 'r',
                label: 'r',
                description: '[Detailed screen] Reset graph zoom to extents',
                fn: () => setTimeout(() => {
                    resetZoom();
                })
            },
            {
                key: 'l',
                label: 'l',
                description: '[Detailed screen] Toggles spectral lines',
                fn: () => setTimeout(() => toggleSpectralLines())
            },
            {
                key: 'left',
                label: 'left',
                description: '[Detailed screen] Decrements redshift by 0.0001',
                fn: () => setTimeout(() => {
                    const z = this.props.ui.detailed.redshift;
                    if (z > this.props.ui.detailed.bounds.redshiftMin) {
                        updateRedShift(parseFloat((z - 0.0001).toFixed(5)));
                    }
                })
            },
            {
                key: 'right',
                label: 'right',
                description: '[Detailed screen] Increments redshift by 0.001',
                fn: () => setTimeout(() => {
                    const z = this.props.ui.detailed.redshift;
                    if (z < this.props.ui.detailed.bounds.redshiftMax) {
                        updateRedShift(parseFloat((z + 0.0001).toFixed(5)));
                    }
                })
            },
            {
                key: 'down',
                label: 'down',
                controller: "detailed",
                description: '[Detailed screen] Selects the next template',
                fn: () => setTimeout(() => {
                    if (document.activeElement !== document.getElementById('#templateInput')) {
                        nextTemplate();
                    }
                })
            },
            {
                key: 'up',
                label: 'up',
                description: '[Detailed screen] Selects the previous template',
                fn: () => setTimeout(() => {
                    if (document.activeElement !== document.getElementById('#templateInput')) {
                        prevTemplate();
                    }
                })
            },
            {
                key: '.',
                label: '.',
                description: '[Detailed screen] Cycles spectral lines forward',
                fn: () => setTimeout(() => nextSpectralLine())
            },
            {
                key: 'comma',
                label: 'comma',
                controller: "detailed",
                description: '[Detailed screen] Cycles spectral lines back',
                fn: () => setTimeout(() => previousSpectralLine())
            },
            {
                key: 'enter',
                label: 'enter',
                controller: "detailed",
                description: '[Detailed screen] Accepts the suggested automatic QOP at the stated redshift',
                fn: () => setTimeout(() => acceptAutoQOP())
            },
            // Merging removed in the new version of marz
            // {
            //     key: 'q',
            //     label: 'q',
            //     controller: "detailed",
            //     description: "[Detailed screen] Cycles which merge result to show",
            //     fn: () => setTimeout(() => toggleMerged())
            // },
        ];

        Enumerable.from(spectraLineService.getAll()).forEach(line => {
            const elem = {
                key: line.shortcut,
                label: line.shortcut,
                controller: "detailed",
                description: '[Detailed screen] Sets the current focus to ' + line.label,
                fn: () => setTimeout(() => clickSpectralLine(line.id), 0)
            };
            keybinds.push(elem);
        });

        Enumerable.from(keybinds).forEach(k => {
            this.addClickHandler(k.key, k.fn);
        });
    }

    render() {
        return null;
    }

    addClickHandler(key, fn) {
        keyboardJS.on(key, function (e) {
            const focus = document.activeElement.tagName.toLowerCase() === 'input';
            if (!focus)
                fn(e);
        });
    };
}

export {
    keybinds,
    KeyBindings,
}
