import { Schema, model } from "mongoose";

const phaseCheckListSchema = new Schema({
  isChecked: { type: Boolean, required: true },
  comment1: { type: String, default: '' },
  comment2: { type: String, default: '' },
  checkListName: { type: String, default: '', required: true },
});

const phaseSchema = new Schema({
  phaseName: { type: String, required: true },
  phaseCheckLists: [phaseCheckListSchema]
});

const projectSchema = new Schema({
  projectName: { type: String, required: true },
  projectId: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  projectStatus: { type: String, required: true },
  phases: [phaseSchema]
});

const Project = model('Project', projectSchema);

export { Project }