import { PrismaClient } from "@prisma/client";



const prisma = new PrismaClient ({
    log: process.env.NODE_ENV === "development" ? ["error", "query", "warn"] : ["error"]
});


const connectDb = async () => {
    try {
        await prisma.$connect();
        console.log("Connection to database sucessful");
    }catch (error){
        console.log("Error connecting to database", error.message);
        process.exit(1);
    }
}


const disconnectDB = async () => {
    await prisma.$disconnect();
}

export {connectDb, disconnectDB}
export default prisma;