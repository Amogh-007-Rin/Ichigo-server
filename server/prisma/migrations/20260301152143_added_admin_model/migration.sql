-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "adminName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_adminName_key" ON "admin"("adminName");

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");
