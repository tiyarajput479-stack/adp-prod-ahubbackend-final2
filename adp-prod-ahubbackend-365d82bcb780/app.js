const express = require('express');
const helmet = require('helmet');
require('dotenv').config();
const { connectSql } = require('./helpers/sqlDb');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const logger = require('./helpers/logger');
const { requestLogger, errorLogger } = require('./helpers/requestLogger');



const AttachmentRouter = require('./Routes/AttachmentRouter');
const userRouter = require('./Routes/userRoutes');
const RoleRouter = require('./Routes/RoleManagementRouter');
const tokenRouter = require('./Routes/TokenRoutes');
const { authenticateToken } = require('./Controllers/TokenControllers');

const NewResourceTrackerRouter = require('./Routes/NewResourceTracker');
const IntakeRouter = require('./Routes/IntakeRouter');
const TrackerFieldOptionRouter = require('./Routes/TrackerFieldOptionRouter');
const ProgramTrackerRouter = require('./Routes/ProgramTrackerRouter');


const privateKey = fs.readFileSync('key.key');
const certificate = fs.readFileSync('certificate.crt');

const credentials = {key: privateKey, cert: certificate}
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({limit: '25mb'}));
app.use(requestLogger);

connectSql();


app.use('/api/v1/', userRouter);
app.use('/api/v1/', authenticateToken,NewResourceTrackerRouter)
app.use('/api/v1/', authenticateToken, TrackerFieldOptionRouter)
app.use('/api/v1/', authenticateToken, ProgramTrackerRouter)
app.use('/api/v1/', authenticateToken,RoleRouter)
app.use('/api/v1', authenticateToken,AttachmentRouter);
app.use('/api/v1/intake', authenticateToken, IntakeRouter)


app.use(errorLogger);



// app.listen(process.env.port, () => {
//   logger.info('server.started', {
//     port: process.env.port,
//     protocol: 'http',
//     pid: process.pid,
//   });
// });

https.createServer(credentials, app).listen(process.env.port, () => {
 logger.info('server.started', {
   port: process.env.port,
   protocol: 'https',
   pid: process.pid,
 });
});


process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', { error: reason });
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', { error });
});
