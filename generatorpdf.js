/********************************************
 * 1) Wczytanie danych z Zgłoszenia.json i inicjalizacja listy sekcji
 ********************************************/
fetch("Zgłoszenia.json")
  .then((response) => response.json())
  .then((data) => {
    // Wstawienie JSON do pola tekstowego
    document.getElementById("jsonInput").value = JSON.stringify(data, null, 2);

    // Pobranie unikalnych sekcji z obiektu data
    const sections = [
      ...new Set(data.data.map((item) => item.memberships[0].section.name)),
    ];
    const sectionSelect = document.getElementById("sectionSelect");

    // Wypełnienie selecta unikalnymi sekcjami
    sections.forEach((section) => {
      const option = document.createElement("option");
      option.value = section;
      option.textContent = section;
      sectionSelect.appendChild(option);
    });
  })
  .catch((error) =>
    console.error("Błąd ładowania pliku Zgłoszenia.json:", error)
  );

/********************************************
 * 2) Funkcja pomocnicza do wczytywania LOGO.jpg
 *    i konwersji na Base64 (dataURL)
 ********************************************/
function getLogoAsBase64(url) {
  return fetch(url)
    .then((response) => response.blob())
    .then((blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // -> base64
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });
}

/********************************************
 * 3) Nasłuchiwanie kliknięcia na przyciski
 ********************************************/
document
  .getElementById("generatePdfBtn")
  .addEventListener("click", () => generatePDF(true));

document
  .getElementById("previewPdfBtn")
  .addEventListener("click", () => generatePDF(false));

/********************************************
 * 4) Główna funkcja generująca PDF
 ********************************************/
async function generatePDF(download = true) {
  const jsonInput = document.getElementById("jsonInput").value;
  const selectedSection = document.getElementById("sectionSelect").value;
  let jsonData;

  // 4.1) Przetwarzanie wpisanego / wczytanego JSON
  try {
    jsonData = JSON.parse(jsonInput);
  } catch (error) {
    alert("Niepoprawny format JSON");
    return;
  }

  // 4.2) Filtrowanie danych na podstawie wybranej sekcji
  const filteredData = jsonData.data.filter(
    (item) => item.memberships[0].section.name === selectedSection
  );

  if (filteredData.length === 0) {
    alert("Brak danych dla wybranej sekcji");
    return;
  }

  // 4.3) Pobranie pliku LOGO.jpg jako base64
  let logoBase64;
  try {
    // Jeśli LOGO.jpg leży w tym samym folderze co index.html:
    logoBase64 = await getLogoAsBase64("LOGO.jpg");
  } catch (err) {
    console.error("Błąd pobierania LOGO:", err);
    alert("Nie udało się pobrać pliku LOGO.jpg");
    return;
  }

  // 4.4) Funkcja generująca tabele (z poszczególnych wpisów)
  function generateTablesForEntries(entries) {
    return entries
      .map((entry, index) => {
        // Rozbijamy notatki na linie
        const notesLines = entry.notes
          .split("\n")
          .filter((line) => line.trim() !== "");

        // Pomocnicza funkcja - odczytuje wartość w wierszu tuż za podaną etykietą
        function findValue(label) {
          const idx = notesLines.findIndex((line) => line.trim() === label);
          return idx !== -1 && idx + 1 < notesLines.length
            ? notesLines[idx + 1].trim()
            : "Brak danych";
        }

        // Pomocnicza funkcja - odczytuje kolejne linie jako listę
        function findList(label) {
          const idx = notesLines.findIndex((line) => line.trim() === label);
          if (idx === -1) return "Brak danych";
          let listItems = [];
          for (let i = idx + 1; i < notesLines.length; i++) {
            // Przerywamy, jeśli linia jest pusta lub wygląda na nową etykietę
            if (notesLines[i].trim() === "" || notesLines[i].match(/^\w/)) {
              break;
            }
            listItems.push(notesLines[i].trim());
          }
          return listItems.length > 0 ? { ul: listItems } : "Brak danych";
        }

        return [
          // Jeśli nie pierwszy wpis, wstaw pageBreak, żeby zaczynał się od nowej strony
          index > 0 ? { text: "", pageBreak: "before" } : {},

          {
            text: `Raport Awarii ${selectedSection}`,
            style: "header",
            alignment: "center",
          },
          (() => {
            const currentDate = new Date();
            const formattedDate = currentDate.toISOString().slice(0, 10);

            // a dopiero potem zwróć obiekt, który pdfMake wstawi do treści
            return {
              text: `Data wygenerowania: ${formattedDate}`,
              alignment: "center",
              margin: [0, 5, 0, 20],
            };
          })(),
          {
            text: `Dane zgłaszającego: ${entry.name}`,
            style: "subheader",
            margin: [0, 20, 0, 5],
          },
          {
            text: `Awaria z dnia: ${
              entry.due_on ? entry.due_on : "Brak informacji"
            }`,
            margin: [0, 0, 0, 15],
          },
          {
            table: {
              headerRows: 1,
              widths: ["35%", "65%"],
              body: [
                [
                  {
                    text: "Informacje z przyjęcia awarii",
                    colSpan: 2,
                    style: "tableHeader",
                  },
                  {},
                ],
                ["Adres miejsca awarii", findValue("Adres miejsca awarii")],
                ["Opis zgłoszenia", findValue("Opis zgłoszenia")],
              ],
            },
            margin: [0, 10, 0, 20],
          },
          {
            table: {
              headerRows: 1,
              widths: ["35%", "65%"],
              body: [
                [
                  {
                    text: "Informacje po zakończeniu awarii",
                    colSpan: 2,
                    style: "tableHeader",
                  },
                  {},
                ],
                [
                  "Współrzędne awarii",
                  (function () {
                    // Odczytujemy surową wartość, np. "52.7826..., 18.7226..."
                    const coordsString = findValue("Współrzędne awarii");

                    // Budujemy link do Google Maps (wersja /search/ z parametrem &query=)
                    const googleMapsUrl =
                      "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(coordsString);

                    // Zwracamy obiekt, który pdfMake wyrenderuje jako klikalny link
                    return {
                      text: coordsString,
                      link: googleMapsUrl,
                    };
                  })(),
                ],
                [
                  "Czy zgodność w Geoportalu",
                  findValue(
                    "Czy usytuowanie sieci wodociągowej na mapie zasadniczej w Geoportalu jest zgodne ze stanem faktycznym ?"
                  ),
                ],
                ["Opis awarii", findValue("Opis awarii")],
                [
                  "Data i godzina usunięcia awarii",
                  findValue("Data i godzina usunięcia awarii"),
                ],
                [
                  "Zakres wykonanych prac",
                  findList("Zakres wykonanych prac przy usunięciu awarii"),
                ],
                ["Użyte materiały", findList("Użyte materiały")],
                [
                  "Link do dokumentacji zdjęciowej",
                  {
                    text: findValue("Link do dokumentacji zdjęciowej"),
                    link: findValue("Link do dokumentacji zdjęciowej"),
                    target: "_blank",
                  },
                ],
              ],
            },
            margin: [0, 10, 0, 20],
          },
        ];
      })
      .flat();
  }

  /********************************************
   * 4.5) Definicja dokumentu PDF (docDefinition) dla pdfMake
   *      z LOGO w headerze powtarzanym na każdej stronie
   ********************************************/
  const docDefinition = {
    // Własność "header" jest rysowana na każdej stronie
    header: {
      margin: [0, 25, 0, 10],
      columns: [
        { width: "*", text: "" },
        {
          image: logoBase64,
          width: 250, // szerokość logotypu
          alignment: "center",
        },
        { width: "*", text: "" },
      ],
    },

    // Treść główna (tabele, teksty)
    content: generateTablesForEntries(filteredData),

    // Style
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 14, bold: true },
      tableHeader: {
        fontSize: 14,
        bold: true,
        fillColor: "#dddddd",
        alignment: "center",
      },
    },
    // Zwiększamy górny margines, by treść nie zachodziła na nagłówek
    pageMargins: [40, 80, 40, 40], // left, top, right, bottom
  };

  /********************************************
   * 4.6) Pobieranie (download) lub otwieranie (open) PDF
   ********************************************/
  if (download) {
    pdfMake.createPdf(docDefinition).download(`raport_${selectedSection}.pdf`);
  } else {
    pdfMake.createPdf(docDefinition).open();
  }
}
