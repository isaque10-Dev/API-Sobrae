
import multer from "multer";
import { randomUUID } from "node:crypto";

const armazenamento = multer.diskStorage({
    destination: "uploads/",

    filename: function(req, file, cb) {
        let extensao = ".jpg";

        if (file.mimetype === "image/png") {
            extensao = ".png";
        }

        if (file.mimetype === "image/webp") {
            extensao = ".webp";
        }

        cb(null, randomUUID() + extensao);
    }
});

export const upload = multer({
    storage: armazenamento,
    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: function(req, file, cb) {
        if (
            file.mimetype === "image/jpeg" ||
            file.mimetype === "image/png" ||
            file.mimetype === "image/webp"
        ) {
            cb(null, true);
        } else {
            cb(new Error("Envie uma imagem JPG, PNG ou WEBP."));
        }
    }
});
