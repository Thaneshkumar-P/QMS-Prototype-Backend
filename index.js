import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import { createHandler } from "graphql-http/lib/use/express"
import { buildSchema } from 'graphql'
import { User } from './models/User.js'
import { Project } from './models/Project.js'
import { ruruHTML } from "ruru/server";
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import 'dotenv/config.js'


var app = express()

app.use(bodyParser.json())
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }))
app.use(cookieParser())

mongoose.connect(process.env.mongoDB, {
  dbName: 'Application'
})
.then(() => {
  console.log('Connected to MongoDB on mongoose');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

const schema = buildSchema(`
    type PhaseCheckList {
        isChecked: Boolean!
        comment1: String
        comment2: String
        checkListName: String!
    }

    type Phase {
        phaseName: String!
        phaseCheckLists: [PhaseCheckList!]
    }

    type Project {
        projectName: String!
        projectId: String!
        category: String!
        projectStatus: String!
        phases: [Phase!]
    }

    type ProjectResponse {
        message: String
        status: Boolean!
        project: Project
    }

    type LoginResponse {
        message: String
        token: String
        status: Boolean!
        admin: Boolean!
    }

    type RegisterResponse {
        message: String
        status: Boolean!
        username: String
        email: String
        password: String
    }

    type Mutation {
        Register(username: String!, password: String!, email: String!, admin: Boolean!): RegisterResponse!
        Login(email: String!, password: String!): LoginResponse!
        createProject(projectName: String!, projectId: String!, category: String!, projectStatus: String!, phases: [PhaseInput!]): ProjectResponse!
        updateProject(projectId: String!, projectStatus: String, projectName: String!, category: String!): ProjectResponse!
        deleteProject(projectId: String!): ProjectResponse!
        addPhase(projectId: String!, phase: PhaseInput!): ProjectResponse!
        addCheckList(projectId: String!, phaseIndex: Int!, checkList: PhaseCheckListInput!): ProjectResponse!
        updateCheckList(projectId: String!, phaseIndex: Int!, checkListIndex: Int!, checkList: PhaseCheckListInput!): ProjectResponse!
    }

    type User {
        username: String
        email: String
        admin: Boolean
        iat: Int
        exp: Int
        error: String
    }
    
    type Query {
        getUserDetails: User
        getProject(projectId: String!): Project
        getProjects: [Project]
        getUsers: [User]
    }

    input PhaseCheckListInput {
        isChecked: Boolean!
        comment1: String
        comment2: String
        checkListName: String!
    }

    input PhaseInput {
        phaseName: String!
        phaseCheckLists: [PhaseCheckListInput!]
    }
`);


const root = {
    Register: async ({ username, password, email, admin }, context) => {
        let { Cookies } = context;
        let token = Cookies.token;
        if (token) {
            let decodedToken = jwt.verify(token, process.env.JWTS);
            let { adminUser, iat, exp } = decodedToken;
            if (adminUser) {
                console.log(decodedToken)
                try {
                    let hashedPassword
                    if(password)
                        hashedPassword = await bcrypt.hash(password, 10); 
                    const newUser = new User({ username, password: hashedPassword, email, admin: admin });
                    if (await newUser.save()) 
                        return { message: 'New User has been created', status: true };
                    return { message: 'Error', status: false };
                } catch (error) {
                    console.error('Error creating user:', error);
                    return { message: 'Error Creating User', status: false, 
                        username: error?.errors?.username?.properties.message ?? null,
                        email: error?.errors?.email?.properties.message ?? null,
                        password: error?.errors?.password?.properties.message ?? null,
                    };
                }        
            }
            else {
                return { message: 'Unauthorized Access', status: false }
            }
        } else {
            return { message: 'No token found', status: false };
        }
    },
    Login: async ({ email, password }) => {
        try {
            const user = await User.findOne({ email });
            console.log(email)
            let validation = bcrypt.compare(password, 'Admin1234')
            if (validation) {
                let token = jwt.sign({ email, adminUser: user.admin }, process.env.JWTS)
                console.log(token)
                return { message: 'Login successful', status: true, token: token, admin: user.admin };
            } else {
                return { message: 'Invalid email or password', status: false };
            }
        } catch (error) {
            console.log('Error finding user:', error);
            return { message: 'Error', status: false };
        }
    },
    getUserDetails: async (_, context) => {
        try {
            let { Cookies } = context;
            let token = Cookies.token;
            let decodedToken = jwt.verify(token, process.env.JWTS);
            let { email, iat, exp } = decodedToken;
            if (email) {
                console.log(exp);
                if (exp) {
                    let user = await User.findOne({ username: decodedToken.email });
                    return { username: username, email: user.email, iat: iat, exp: exp };
                }
            } else {
                return { error: 'No token found' };
            }
        } catch (error) {
            console.error('Error verifying token:', error.name);
            if (error.name === 'TokenExpiredError') {
                return { error: 'Unauthorized Access: Token has expired' };
            } else {
                return { error: 'Unauthorized Access: Invalid token' };
            }
        }
    },
    createProject: async ({ projectName, projectId, category, projectStatus, phases }) => {
        try {
            const newProject = new Project({
                projectName,
                projectId,
                category,
                projectStatus,
                phases
            });
            await newProject.save();
            return { message: 'Project created successfully', status: true, project: newProject };
        } catch (error) {
            console.error('Error creating project:', error);
            return { message: 'Error', status: false };
        }
    },
    updateProject: async ({ projectId, projectStatus, projectName, category }) => {
        try {
            const project = await Project.findOne({ projectId });
            if (!project) return { message: 'Project not found', status: false };
            project.projectName = projectName || project.projectName;
            project.category = category || project.category;
            project.projectStatus = projectStatus || project.projectStatus;
            await project.save();
            return { message: 'Project updated successfully', status: true, project };
        } catch (error) {
            console.error('Error updating project:', error);
            return { message: 'Error', status: false };
        }
    },
    deleteProject: async ({ projectId }) => {
        try {
            const project = await Project.findOneAndDelete({ projectId });
            if (!project) return { message: 'Project not found', status: false };

            return { message: 'Project deleted successfully', status: true, project };
        } catch (error) {
            console.error('Error deleting project:', error);
            return { message: 'Error', status: false };
        }
    },
    getProject: async ({ projectId }) => {
        try {
            const project = await Project.findOne({ projectId });
            if (!project) return null;
            return project;
        } catch (error) {
            console.error('Error fetching project:', error);
            return null;
        }
    },
    getProjects: async () => {
        try {
            const projects = await Project.find();
            return projects;
        } catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
    },
    getUsers: async () => {
        try {
            const users = await User.find();
            return users;
        } catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
    },
    addPhase: async ({ projectId, phase }, context) => {
        try {
            let { Cookies } = context;
            let token = Cookies.token;
            let decodedToken = jwt.verify(token, process.env.JWTS);
            let { email, iat, exp } = decodedToken;
            console.log(decodedToken)
            if (email) {
                const project = await Project.findOne({ projectId });
                project.phases.push(phase)
                project.save()
                return { message: 'Phase Successfully added', status: true, project }
            } else {
                return { error: 'No token found', status: false };
            }
        } catch (error) {
            console.error('Error verifying token:', error.name);
            if (error.name === 'TokenExpiredError') {
                return { message: 'Unauthorized Access: Token has expired', status: false };
            } else {
                return { message: 'Unauthorized Access: Invalid token', status: false };
            }
        }
    },
    addCheckList: async ({ projectId, phaseIndex, checkList }, context) => {
        try {
            let { Cookies } = context;
            let token = Cookies.token;
            let decodedToken = jwt.verify(token, process.env.JWTS);
            let { email, iat, exp } = decodedToken;
            console.log(decodedToken)
            if (email) {
                const project = await Project.findOne({ projectId });
                project.phases[phaseIndex].phaseCheckLists.push(checkList)
                project.save()
                return { message: `Checklist Successfully added to phase: ${project.phases[phaseIndex].phaseName}`, status: true, project }
            } else {
                return { error: 'No token found', status: false };
            }
        } catch (error) {
            console.error('Error verifying token:', error.name);
            if (error.name === 'TokenExpiredError') {
                return { message: 'Unauthorized Access: Token has expired', status: false };
            } else {
                return { message: 'Unauthorized Access: Invalid token', status: false };
            }
        }
    },
    updateCheckList: async ({ projectId, phaseIndex, checkListIndex, checkList }, context) => {
        try {
            let { Cookies } = context;
            let token = Cookies.token;
            let decodedToken = jwt.verify(token, process.env.JWTS);
            let { email, iat, exp } = decodedToken;
            console.log(decodedToken)
            if (email) {
                const project = await Project.findOne({ projectId });
                let data = project.phases[phaseIndex].phaseCheckLists[checkListIndex]
                data.comment1 = checkList.comment1
                data.comment2 = checkList.comment2
                data.isChecked = checkList.isChecked
                project.save()
                return { message: `Checklist Successfully updated`, status: true, project }
            } else {
                return { error: 'No token found', status: false };
            }
        } catch (error) {
            console.error('Error verifying token:', error.name);
            if (error.name === 'TokenExpiredError') {
                return { message: 'Unauthorized Access: Token has expired', status: false };
            } else {
                return { message: 'Unauthorized Access: Invalid token', status: false };
            }
        }
    }
};

app.post("/set-cookie", (req, res) => {
    try{
        res.cookie('token', req.body.token, {
            // httpOnly: true,
            // secure: true
        })
        res.send()
    }
    catch{
        res.send()
    }
})

app.get("/", (req, res) => {
    req.cookies
    res.type("html")
    res.end(ruruHTML({ endpoint: "/graphql" }))
})
  
app.all('/graphql', createHandler({
    schema: schema,
    rootValue: root,
    context: req => ({
        Cookies: req.raw.cookies
    }),
    graphiql: true
}));

app.get('/test', (req, res) => {
    console.log(req.cookies);
    res.send('Test endpoint');
});

app.listen(4000, () => {
    console.log(`GraphQL running on port ${process.env.GQPORT}`)
})


