import app from "./app";
import config from "./config/config";

app.listen(config.port, () => {
  console.log(` Server running in ${config.nodeEnv} mode at http://localhost:${config.port}`);
});
