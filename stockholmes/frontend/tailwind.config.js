export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070A12", slate2: "#0E1424", slate3: "#151C30", fog: "#9AA7BD", mist: "#D6DEEC",
        gain: "#2DF5A0", loss: "#FF4D6D", azure: "#4DA3FF", violet: "#9B7BFF", lamp: "#FFB547",
      },
      fontFamily: { display: ["Fraunces", "Georgia", "serif"], sans: ["Space Grotesk", "Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
