import PDFDocument from "pdfkit";
import prisma from "../database/postgres.js";

/**
 * GET /api/v1/inventory/receipts/:id/download
 *
 * Generates a PDF receipt for the given sale and streams it
 * as a downloadable file (Content-Disposition: attachment).
 */
export const downloadReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        // ── Fetch the sale with all related data ──────────────────────
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: {
                feedItem: {
                    select: {
                        name: true,
                        category: {
                            select: { name: true },
                        },
                    },
                },
                transaction: {
                    select: {
                        reference: true,
                    },
                },
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!sale) {
            return res.status(404).json({ error: "Receipt not found." });
        }

        // ── Check Format ──────────────────────────────────────────────
        const isThermal = req.query.format === "thermal";

        let docOptions = {
            size: "A4",
            margin: 50,
            info: {
                Title: `Receipt ${sale.receiptNumber}`,
                Author: "Gbenro Global Synergy Ltd",
            },
        };

        if (isThermal) {
            // Calculate height dynamically to prevent trailing empty space
            let dynamicHeight = 310;
            if (sale.buyerName) dynamicHeight += 18;
            if (sale.notes) {
                const noteLines = Math.ceil(sale.notes.length / 32);
                dynamicHeight += noteLines * 12 + 15;
            }
            docOptions = {
                size: [226.77, dynamicHeight], // 80mm width standard
                margin: 12,
                info: docOptions.info,
            };
        }

        const doc = new PDFDocument(docOptions);

        // Set response headers so the browser triggers a download
        const filename = `receipt-${sale.receiptNumber}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        // Pipe the PDF stream straight into the HTTP response
        doc.pipe(res);

        if (isThermal) {
            // ── Thermal POS Supermarket Layout ──────────────────────
            const printableWidth = 226.77 - 24; // Width minus left/right margins

            // Helper to draw dashed lines
            const drawDashedDivider = (y) => {
                doc.moveTo(12, y)
                    .lineTo(226.77 - 12, y)
                    .strokeColor("#000000")
                    .lineWidth(0.8)
                    .dash(3, { space: 2 })
                    .stroke()
                    .undash();
            };

            // Store Header
            doc.fontSize(10)
                .fillColor("#000000")
                .font("Helvetica-Bold")
                .text("GBENRO GLOBAL SYNERGY LTD", 12, 12, { align: "center", width: printableWidth });

            doc.fontSize(7)
                .font("Helvetica")
                .text("Poultry Feed Inventory Management", 12, 24, { align: "center", width: printableWidth });

            doc.fontSize(10)
                .font("Helvetica-Bold")
                .text("SALES RECEIPT", 12, 38, { align: "center", width: printableWidth });

            let currentY = 52;
            drawDashedDivider(currentY);
            currentY += 6;

            // Metadata info
            doc.fontSize(7).font("Helvetica-Bold");
            doc.text("Receipt No: ", 12, currentY);
            doc.font("Helvetica").text(sale.receiptNumber, 62, currentY);
            currentY += 10;

            doc.font("Helvetica-Bold").text("Date: ", 12, currentY);
            doc.font("Helvetica").text(
                new Date(sale.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }),
                62,
                currentY
            );
            currentY += 10;

            doc.font("Helvetica-Bold").text("Cashier: ", 12, currentY);
            doc.font("Helvetica").text(`${sale.user.firstName} ${sale.user.lastName}`, 62, currentY);
            currentY += 10;

            if (sale.transaction.reference) {
                doc.font("Helvetica-Bold").text("Ref: ", 12, currentY);
                doc.font("Helvetica").text(sale.transaction.reference, 62, currentY);
                currentY += 10;
            }

            if (sale.buyerName) {
                doc.font("Helvetica-Bold").text("Buyer: ", 12, currentY);
                doc.font("Helvetica").text(sale.buyerName, 62, currentY);
                currentY += 10;
            }

            currentY += 2;
            drawDashedDivider(currentY);
            currentY += 6;

            // Table headers
            doc.fontSize(7).font("Helvetica-Bold");
            doc.text("ITEM", 12, currentY);
            doc.text("QTY", 110, currentY, { width: 25, align: "right" });
            doc.text("PRICE", 140, currentY, { width: 35, align: "right" });
            doc.text("TOTAL", 180, currentY, { width: 35, align: "right" });
            currentY += 10;

            drawDashedDivider(currentY);
            currentY += 6;

            // Item Row
            doc.fontSize(7).font("Helvetica");
            // Wrap the feed item name to prevent it from overlapping other columns
            doc.text(sale.feedItem.name, 12, currentY, { width: 95 });
            doc.text(String(sale.quantity), 110, currentY, { width: 25, align: "right" });
            doc.text(
                `₦${Number(sale.unitPrice).toFixed(0)}`,
                140,
                currentY,
                { width: 35, align: "right" }
            );
            doc.text(
                `₦${Number(sale.totalPrice).toFixed(0)}`,
                180,
                currentY,
                { width: 35, align: "right" }
            );

            // Determine if the wrapped item name pushed the position lower
            const itemHeight = doc.heightOfString(sale.feedItem.name, { width: 95 });
            currentY += Math.max(itemHeight, 10) + 4;

            drawDashedDivider(currentY);
            currentY += 6;

            // Totals
            doc.fontSize(8).font("Helvetica-Bold");
            doc.text("TOTAL DUE:", 12, currentY);
            doc.text(
                `₦${Number(sale.totalPrice).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                140,
                currentY,
                { width: 75, align: "right" }
            );
            currentY += 14;

            drawDashedDivider(currentY);
            currentY += 6;

            // Notes
            if (sale.notes) {
                doc.fontSize(7).font("Helvetica-Bold").text("Notes:", 12, currentY);
                currentY += 9;
                doc.font("Helvetica").text(sale.notes, 12, currentY, { width: printableWidth });
                const notesHeight = doc.heightOfString(sale.notes, { width: printableWidth });
                currentY += notesHeight + 6;
                drawDashedDivider(currentY);
                currentY += 6;
            }

            // Footer
            doc.fontSize(7)
                .font("Helvetica")
                .text("Thank you for your patronage!", 12, currentY, { align: "center", width: printableWidth });
            currentY += 10;
            doc.text("Please keep receipt as proof of purchase.", 12, currentY, { align: "center", width: printableWidth });

        } else {
            // ── Standard A4 Corporate Layout ─────────────────────────────
            // Colors & constants
            const PRIMARY = "#1a5276"; // deep blue
            const ACCENT = "#2e86c1"; // lighter blue
            const LIGHT_BG = "#f4f6f7"; // subtle grey for table rows
            const TEXT = "#2c3e50";
            const MUTED = "#7f8c8d";
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

            // Header band
            doc.rect(0, 0, doc.page.width, 110).fill(PRIMARY);

            doc.fontSize(22)
                .fill("#ffffff")
                .font("Helvetica-Bold")
                .text("GBENRO GLOBAL SYNERGY LTD", 50, 30, { width: pageWidth });

            doc.fontSize(10)
                .fill("#d5dbdb")
                .font("Helvetica")
                .text("Poultry Feed Inventory Management", 50, 58, {
                    width: pageWidth,
                });

            // Receipt badge on the right
            doc.fontSize(24)
                .fill("#ffffff")
                .font("Helvetica-Bold")
                .text("RECEIPT", 50, 75, {
                    width: pageWidth,
                    align: "right",
                });

            // Receipt metadata section
            const metaY = 130;

            // Left column
            doc.fontSize(9).fill(MUTED).font("Helvetica").text("Receipt No.", 50, metaY);
            doc.fontSize(11).fill(TEXT).font("Helvetica-Bold").text(sale.receiptNumber, 50, metaY + 14);

            doc.fontSize(9).fill(MUTED).font("Helvetica").text("Date", 50, metaY + 38);
            doc.fontSize(11)
                .fill(TEXT)
                .font("Helvetica")
                .text(
                    new Date(sale.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                    }),
                    50,
                    metaY + 52
                );

            // Right column
            doc.fontSize(9).fill(MUTED).font("Helvetica").text("Reference", 350, metaY);
            doc.fontSize(11)
                .fill(TEXT)
                .font("Helvetica")
                .text(sale.transaction.reference || "N/A", 350, metaY + 14);

            doc.fontSize(9).fill(MUTED).font("Helvetica").text("Sold By", 350, metaY + 38);
            doc.fontSize(11)
                .fill(TEXT)
                .font("Helvetica")
                .text(
                    `${sale.user.firstName} ${sale.user.lastName}`,
                    350,
                    metaY + 52
                );

            // Buyer info (if present)
            if (sale.buyerName) {
                doc.fontSize(9).fill(MUTED).font("Helvetica").text("Buyer", 50, metaY + 76);
                doc.fontSize(11).fill(TEXT).font("Helvetica").text(sale.buyerName, 50, metaY + 90);
            }

            // Divider
            const tableTopY = sale.buyerName ? metaY + 120 : metaY + 100;

            doc.moveTo(50, tableTopY)
                .lineTo(50 + pageWidth, tableTopY)
                .strokeColor(ACCENT)
                .lineWidth(1.5)
                .stroke();

            // Table header
            const cols = {
                item: 50,
                category: 220,
                qty: 320,
                unitPrice: 390,
                total: 470,
            };

            const headerY = tableTopY + 10;

            doc.rect(50, headerY - 4, pageWidth, 22).fill(PRIMARY);

            doc.fontSize(9)
                .fill("#ffffff")
                .font("Helvetica-Bold");

            doc.text("ITEM", cols.item + 8, headerY + 2);
            doc.text("CATEGORY", cols.category + 8, headerY + 2);
            doc.text("QTY", cols.qty + 8, headerY + 2);
            doc.text("UNIT PRICE", cols.unitPrice + 8, headerY + 2);
            doc.text("TOTAL", cols.total + 8, headerY + 2);

            // Table row (single line-item receipt)
            const rowY = headerY + 26;

            doc.rect(50, rowY - 4, pageWidth, 24).fill(LIGHT_BG);

            doc.fontSize(10).fill(TEXT).font("Helvetica");
            doc.text(sale.feedItem.name, cols.item + 8, rowY + 2, { width: 160 });
            doc.text(sale.feedItem.category.name, cols.category + 8, rowY + 2, { width: 90 });
            doc.text(String(sale.quantity), cols.qty + 8, rowY + 2, { width: 60 });
            doc.text(
                `₦${Number(sale.unitPrice).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                cols.unitPrice + 8,
                rowY + 2,
                { width: 70 }
            );
            doc.text(
                `₦${Number(sale.totalPrice).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                cols.total + 8,
                rowY + 2,
                { width: 80 }
            );

            // Totals section
            const totalsY = rowY + 40;

            // Subtle line above totals
            doc.moveTo(350, totalsY)
                .lineTo(50 + pageWidth, totalsY)
                .strokeColor("#bdc3c7")
                .lineWidth(0.5)
                .stroke();

            doc.fontSize(10).fill(MUTED).font("Helvetica").text("Subtotal", 350, totalsY + 10);
            doc.fontSize(10)
                .fill(TEXT)
                .font("Helvetica")
                .text(
                    `₦${Number(sale.totalPrice).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                    cols.total + 8,
                    totalsY + 10
                );

            // Grand total with emphasis
            doc.rect(345, totalsY + 30, pageWidth - 295, 28).fill(PRIMARY);

            doc.fontSize(12)
                .fill("#ffffff")
                .font("Helvetica-Bold")
                .text("TOTAL", 355, totalsY + 37);

            doc.fontSize(12)
                .fill("#ffffff")
                .font("Helvetica-Bold")
                .text(
                    `₦${Number(sale.totalPrice).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                    cols.total + 8,
                    totalsY + 37
                );

            // Notes
            if (sale.notes) {
                const notesY = totalsY + 80;
                doc.fontSize(9).fill(MUTED).font("Helvetica").text("Notes", 50, notesY);
                doc.fontSize(10)
                    .fill(TEXT)
                    .font("Helvetica")
                    .text(sale.notes, 50, notesY + 14, { width: pageWidth });
            }

            // Footer
            const footerY = doc.page.height - 80;

            doc.moveTo(50, footerY)
                .lineTo(50 + pageWidth, footerY)
                .strokeColor("#bdc3c7")
                .lineWidth(0.5)
                .stroke();

            doc.fontSize(8)
                .fill(MUTED)
                .font("Helvetica")
                .text("Thank you for your patronage!", 50, footerY + 10, {
                    width: pageWidth,
                    align: "center",
                });

            doc.fontSize(7)
                .fill(MUTED)
                .font("Helvetica")
                .text(
                    "Gbenro Global Synergy Ltd — Poultry Feed Inventory System",
                    50,
                    footerY + 24,
                    { width: pageWidth, align: "center" }
                );

            doc.fontSize(7)
                .fill(MUTED)
                .font("Helvetica")
                .text(
                    `Generated on ${new Date().toLocaleString("en-GB")}`,
                    50,
                    footerY + 36,
                    { width: pageWidth, align: "center" }
                );
        }

        // ── Finalize ─────────────────────────────────────────────────
        doc.end();
    } catch (error) {
        console.error("Error generating receipt PDF:", error);

        // If headers were already sent (partial stream), we can't send JSON
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate receipt PDF." });
        }
    }
};
