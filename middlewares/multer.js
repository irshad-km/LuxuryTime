import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = "public/uploads";

//check
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true })
}

//store
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath)
    },

//file name uniq    
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});


const upload = multer({ storage });

export default upload;