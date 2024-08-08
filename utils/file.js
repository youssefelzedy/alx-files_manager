import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import dbClient from './db';
// import userUtils from './user';
import basicUtils from './basic';

/**
 * Module with file utilities
 */
const fileUtils = {
  /**
   * Validates if body is valid for creating file
   * @request {request_object} express request obj
   * @return {object} object with err and validated params
   */
  async validateBody (request) {
    const {
      name, type, isPublic = false, data
    } = request.body;

    let { parentId = 0 } = request.body;

    const typesAllowed = ['file', 'image', 'folder'];

    let msg = null;

    if (parentId === '0') parentId = 0;

    if (!name) {
      msg = 'Missing name';
    } else if (!type || !typesAllowed.includes(type)) {
      msg = 'Missing type';
    } else if (!data && type !== 'folder') {
      msg = 'Missing data';
    } else if (parentId && parentId !== '0') {
      let file;

      if (basicUtils.isValidId(parentId)) {
        file = await this.getFile({
          _id: ObjectId(parentId)
        });
      } else {
        file = null;
      }

      if (!file) {
        msg = 'Parent not found';
      } else if (file.type !== 'folder') {
        msg = 'Parent is not a folder';
      }
    }
    const obj = {
      error: msg,
      fileParams: {
        name,
        type,
        isPublic,
        parentId,
        data
      }
    };
    return obj;
  },

  /**
     * gets file document from db
     * @query {obj} query used to find file
     * @return {object} file
     */
  async getFile (query) {
    const file = await dbClient.filesCollection.findOne(query);
    return file;
  },

  /**
     * gets list of file documents from db belonging
     * to a parent id
     * @query {obj} query used to find file
     * @return {Array} list of files
     */
  async getFilesOfParentId (query) {
    const fileList = await dbClient.filesCollection.aggregate(query);
    return fileList;
  },
  /**
   * saves files to database and disk
   * @userId {string} query used to find file
   * @fileParams {obj} object with attributes of file to save
   * @FOLDER_PATH {string} path to save file in disk
   * @return {obj} object with error if present and file
   */
  async saveFile (userId, fileParams, FOLDER_PATH) {
    const {
      name, type, isPublic, data
    } = fileParams;
    let { parentId } = fileParams;

    if (parentId !== 0) parentId = ObjectId(parentId);

    const query = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId
    };

    if (fileParams.type !== 'folder') {
      const fileNameUUID = uuidv4();

      // const fileDataDecoded = Buffer.from(data, 'base64').toString('utf-8');
      const fileDataDecoded = Buffer.from(data, 'base64');

      const path = `${FOLDER_PATH}/${fileNameUUID}`;

      query.localPath = path;

      try {
        await fsPromises.mkdir(FOLDER_PATH, { recursive: true });
        await fsPromises.writeFile(path, fileDataDecoded);
      } catch (err) {
        return { error: err.message, code: 400 };
      }
    }

    const result = await dbClient.filesCollection.insertOne(query);

    const file = this.processFile(query);

    const newFile = { id: result.insertedId, ...file };

    return { error: null, newFile };
  },
  /**
    * Updates a file document in database
    * @query {obj} query to find document to update
    * @set {obj} object with query info to update in Mongo
    * @return {object} updated file
    */
  async updateFile (query, set) {
    const fileList = await dbClient.filesCollection.findOneAndUpdate(
      query,
      set,
      { returnOriginal: false }
    );
    return fileList;
  },
  /**
     * Transform _id into id in a file document
     * @doc {object} document to be processed
     * @return {object} processed document
     */
  processFile (doc) {
    // Changes _id for id and removes localPath

    const file = { id: doc._id, ...doc };

    delete file.localPath;
    delete file._id;

    return file;
  }

};

export default fileUtils;
