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

        // ── Build the PDF ─────────────────────────────────────────────
        const doc = new PDFDocument({
            size: "A4",
            margin: 50,
            info: {
                Title: `Receipt ${sale.receiptNumber}`,
                Author: "Gbenro Global Synergy Ltd",
            },
        });

        // Set response headers so the browser triggers a download
        const filename = `receipt-${sale.receiptNumber}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        // Pipe the PDF stream straight into the HTTP response
        doc.pipe(res);

        // ── Colours & constants ───────────────────────────────────────
        const PRIMARY = "#1a5276"; // deep blue
        const ACCENT = "#2e86c1"; // lighter blue
        const LIGHT_BG = "#f4f6f7"; // subtle grey for table rows
        const TEXT = "#2c3e50";
        const MUTED = "#7f8c8d";
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // ── Header band ───────────────────────────────────────────────
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

        // ── Receipt metadata section ──────────────────────────────────
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

        // ── Divider ──────────────────────────────────────────────────
        const tableTopY = sale.buyerName ? metaY + 120 : metaY + 100;

        doc.moveTo(50, tableTopY)
            .lineTo(50 + pageWidth, tableTopY)
            .strokeColor(ACCENT)
            .lineWidth(1.5)
            .stroke();

        // ── Table header ─────────────────────────────────────────────
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

        // ── Table row (single line-item receipt) ─────────────────────
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

        // ── Totals section ──────────────────────────────────────────
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

        // ── Notes ────────────────────────────────────────────────────
        if (sale.notes) {
            const notesY = totalsY + 80;
            doc.fontSize(9).fill(MUTED).font("Helvetica").text("Notes", 50, notesY);
            doc.fontSize(10)
                .fill(TEXT)
                .font("Helvetica")
                .text(sale.notes, 50, notesY + 14, { width: pageWidth });
        }

        // ── Footer ──────────────────────────────────────────────────
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
