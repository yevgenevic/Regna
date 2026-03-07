import React, { useRef, useEffect } from 'react';
import './VideoBackground.css';

export default function VideoBackground() {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.8; // Slightly slow down for dramatic effect
        }
    }, []);

    return (
        <div className="video-background-container">
            <div className="video-overlay" />
            <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                className="video-element"
            >
                <source src="/background-video.mp4" type="video/mp4" />
            </video>
        </div>
    );
}
