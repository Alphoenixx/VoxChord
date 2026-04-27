import subprocess
import webbrowser
import time
import sys

def main():
    print("[VoxChord] Starting Development Server...")
    
    # Start the Next.js dev server
    # We use shell=True to easily run npm commands on Windows
    try:
        process = subprocess.Popen(
            "npm run dev", 
            shell=True,
            cwd=".",
        )
    except Exception as e:
        print(f"[Error] Failed to start the server: {e}")
        sys.exit(1)
        
    # Wait for the server to spin up
    print("Waiting for server to initialize (approx 4 seconds)...")
    time.sleep(4)
    
    url = "http://localhost:3000"
    print(f"Opening {url} in your default browser...")
    webbrowser.open(url)
    
    print("\nServer is running. Press Ctrl+C to stop.")
    
    try:
        # Keep script running so the server stays alive
        process.wait()
    except KeyboardInterrupt:
        print("\n[VoxChord] Shutting down...")
        process.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
