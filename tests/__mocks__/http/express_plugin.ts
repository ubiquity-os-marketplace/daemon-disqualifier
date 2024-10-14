import express from "express";
import { validateAndDecodeSchemas } from "../../../src/helpers/validator";
import { run } from "../../../src/run";
import { PluginInputs } from "../../../src/types/plugin-input";
import manifest from "../../../manifest.json";

const app = express();
const port = 4000;

app.use(express.json());

app.post("/", async (req, res) => {
  try {
    const inputs = req.body;
    const { decodedSettings } = validateAndDecodeSchemas(inputs.settings, process.env);
    inputs.settings = decodedSettings;
    const result = await run(inputs);
    res.json(result);
  } catch (error) {
    console.error("Error running plugin:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
