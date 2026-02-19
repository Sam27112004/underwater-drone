# ROV Control Station

A web-based control station for Remotely Operated Vehicles (ROV) with BlueOS integration. This application provides real-time control, video streaming, and telemetry monitoring for underwater drones.

## Features

- 🎮 Real-time ROV control interface
- 📹 Live video streaming
- 📊 Telemetry data monitoring
- 🔌 WebSocket-based communication
- 🌊 BlueOS integration
- 💻 Responsive web interface

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- Git (for cloning the repository)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/underwater-drone.git
   cd underwater-drone
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure BlueOS (optional):**
   
   Create a `.env` file in the project root to customize BlueOS settings:
   ```env
   BLUEOS_IP=192.168.2.2
   BLUEOS_MAVLINK_PORT=80
   BLUEOS_VIDEO_PORT=6020
   ```
   
   Default values are used if no `.env` file is provided.

## Running the Application

### Development Mode

Start the server:
```bash
npm start
```

Or:
```bash
node server.js
```

The server will start on `http://localhost:3000` by default.

### Simple Server (Alternative)

For a simpler HTTP server without WebSocket features:
```bash
node simple-server.js
```

## Usage

1. Open your web browser and navigate to `http://localhost:3000`
2. The ROV Control Station interface will load
3. Connect to your ROV/BlueOS system
4. Use the control interface to operate the vehicle

## Project Structure

```
underwater-drone/
├── public/
│   └── index.html       # Frontend interface
├── server.js            # Main server with WebSocket support
├── simple-server.js     # Basic HTTP server
├── package.json         # Project dependencies
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Configuration

### BlueOS Connection

The application connects to BlueOS using the following default configuration:

- **IP Address:** `192.168.2.2`
- **MAVLink Port:** `80`
- **Video Port:** `6020`

These can be customized via environment variables (see Installation step 3).

## Dependencies

- **express** - Web framework
- **ws** - WebSocket implementation
- **cors** - Cross-origin resource sharing
- **node-fetch** - HTTP request library

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, modify the port in `server.js`.

### Cannot Connect to BlueOS

- Verify the BlueOS IP address is correct
- Ensure your computer is on the same network as the ROV
- Check firewall settings

### Dependencies Installation Failed

Try clearing npm cache and reinstalling:
```bash
npm cache clean --force
npm install
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Acknowledgments

- BlueOS for ROV control system integration
- The underwater robotics community
