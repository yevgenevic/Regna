import React, { useState } from 'react';
import './PromptInterface.css';

export default function PromptInterface({ onGenerate }) {
    const [prompt, setPrompt] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim()) {
            onGenerate(prompt);
        }
    };

    return (
        <div className="prompt-container fade-in-up">
            <div className="prompt-header">
                <h2 className="text-display animate-glitch">NEW STORYBOARD</h2>
                <span className="badge text-mono">AWAITING INPUT...</span>
            </div>

            <form onSubmit={handleSubmit} className={`prompt-box ${isFocused ? 'focused' : ''}`}>
                <textarea
                    className="prompt-input text-mono"
                    placeholder="Describe the action here... (e.g. A cyber-samurai stands in the rain, katana glowing red, high contrast)"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    rows={3}
                />

                <div className="prompt-footer">
                    <div className="style-toggles text-mono">
                        <label className="toggle-label">
                            <input type="radio" name="style" value="shonen" defaultChecked />
                            <span className="toggle-text">SHONEN</span>
                        </label>
                        <label className="toggle-label">
                            <input type="radio" name="style" value="seinen" />
                            <span className="toggle-text">SEINEN</span>
                        </label>
                        <label className="toggle-label">
                            <input type="radio" name="style" value="mecha" />
                            <span className="toggle-text">MECHA</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="generate-btn text-display"
                        disabled={!prompt.trim()}
                    >
                        INITIALIZE
                    </button>
                </div>
            </form>
        </div>
    );
}
