/********************************************
 * 0) KONFIGURACJA ASANY
 ********************************************/
const ASANA_PERSONAL_ACCESS_TOKEN =
  "2/1156801977163652/1209359631182765:a0e0bf82fe2c88c3599a411868ac87cc";
// ↑ Wstaw tutaj swój prawdziwy Personal Access Token

const PROJECT_ID = "1209311081228152"; // Zmień na ID swojego projektu Asany

// Zmienna do przechowywania danych pobranych z Asany
let asanaData = null;

/********************************************
 * POBIERANIE DANYCH Z ASANY
 ********************************************/
function fetchAsanaData() {
  const url = `https://app.asana.com/api/1.0/projects/${PROJECT_ID}/tasks?opt_fields=memberships.section.name,name,notes,due_on`;

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${ASANA_PERSONAL_ACCESS_TOKEN}`,
    },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Błąd pobierania z Asany: ${response.status}`);
    }
    return response.json();
  });
}

/********************************************
 * 1) ŁADOWANIE DANYCH I INICJALIZACJA LISTY SEKCJI
 ********************************************/
document.addEventListener("DOMContentLoaded", () => {
  fetchAsanaData()
    .then((data) => {
      // Zachowaj dane w zmiennej globalnej
      asanaData = data;

      // Pobranie unikalnych sekcji z obiektu data
      const sections = [
        ...new Set(data.data.map((item) => item.memberships[0].section.name)),
      ];
      const sectionSelect = document.getElementById("sectionSelect");

      // Wypełnienie <select> unikalnymi sekcjami
      sections.forEach((section) => {
        const option = document.createElement("option");
        option.value = section;
        option.textContent = section;
        sectionSelect.appendChild(option);
      });
    })
    .catch((error) => console.error("Błąd ładowania danych z Asany:", error));

  // Obsługa kliknięcia przycisków
  document
    .getElementById("generatePdfBtn")
    .addEventListener("click", () => generatePDF(true));

  document
    .getElementById("previewPdfBtn")
    .addEventListener("click", () => generatePDF(false));
});

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
 * 3) GŁÓWNA FUNKCJA GENERUJĄCA PDF
 ********************************************/
async function generatePDF(download = true) {
  // Upewnij się, że mamy dane z Asany
  if (!asanaData) {
    alert("Brak danych z Asany (jeszcze się nie wczytały lub wystąpił błąd).");
    return;
  }

  // Sprawdź, jaka sekcja jest wybrana
  const selectedSection = document.getElementById("sectionSelect").value;
  if (!selectedSection) {
    alert("Wybierz sekcję!");
    return;
  }

  // Filtrowanie danych na podstawie wybranej sekcji
  const filteredData = asanaData.data.filter(
    (item) => item.memberships[0].section.name === selectedSection
  );

  if (filteredData.length === 0) {
    alert("Brak danych dla wybranej sekcji");
    return;
  }

  // Pobranie pliku LOGO.jpg jako base64
  let logoBase64;
  try {
    logoBase64 = await getLogoAsBase64("LOGO.jpg");
  } catch (err) {
    console.error("Błąd pobierania LOGO:", err);
    alert("Nie udało się pobrać pliku LOGO.jpg");
    return;
  }

  // Funkcja generująca tabele (z poszczególnych wpisów)
  function generateTablesForEntries(entries) {
    return entries
      .map((entry, index) => {
        // Rozbijamy notatki na linie
        const notesLines = entry.notes
          ? entry.notes.split("\n").filter((line) => line.trim() !== "")
          : [];

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
            text: `Raport miesięczny ${selectedSection}`,
            style: "header",
            alignment: "center",
          },
          (() => {
            const currentDate = new Date();
            const formattedDate = currentDate.toISOString().slice(0, 10);
            return {
              text: `Data wygenerowania: ${formattedDate}`,
              alignment: "center",
              margin: [0, 5, 0, 20],
            };
          })(),
          {
            text: `Adres awarii: ${entry.name}`,
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
                [
                  "Dane zgłaszającego",
                  findValue("Nazwisko Imie zgłaszającego"),
                ],
                ["Nr tel zgłaszającego", findValue("Nr tel zgłaszającego")],
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
                    const coordsString = findValue("Współrzędne awarii");
                    if (coordsString === "Brak danych") return coordsString;
                    // Link do Google Maps
                    const googleMapsUrl =
                      "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(coordsString);
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
                // [
                //   "Link do dokumentacji zdjęciowej",
                //   (() => {
                //     const link = findValue("Link do dokumentacji zdjęciowej");
                //     if (link === "Brak danych") return link;
                //     return { text: link, link: link, target: "_blank" };
                //   })(),
                // ],
              ],
            },
            margin: [0, 10, 0, 20],
          },
          {
            margin: [0, 10, 0, 0],
            columns: [
              {
                width: "100%",
                stack: [
                  {
                    text: "Stwierdza się, że ww. awaria została usunięta. Na tym protokół zakończono i podpisano.",
                    alignment: "center",
                  },
                ],
              },
            ],
          },
          {
            margin: [0, 0, 0, 0], // odstęp od poprzedniego elementu
            columns: [
              // {
              //   width: "50%",
              //   stack: [
              //     // Podpis lewy
              //     { text: "", margin: [0, 0, 0, 25] },
              //     // można dać pustą linię, żeby zostawić miejsce na podpis "odręczny"
              //     {
              //       text: ".....................................",
              //       alignment: "center",
              //     },
              //     {
              //       text: "Podpis zgłaszającego awarię",
              //       alignment: "center",
              //       fontSize: 10,
              //       margin: [0, 5, 0, 0],
              //     },
              //   ],
              // },
              {
                width: "100%",
                stack: [
                  // Podpis prawy
                  { text: "", margin: [0, 0, 0, 0] },
                  {
                    text: "....................................................................................",
                    alignment: "center",
                  },
                  {
                    text: "Podpis Wykonawcy lub osoby upoważnionej",
                    alignment: "center",
                    fontSize: 10,
                    margin: [0, 0, 0, 0],
                  },
                ],
              },
            ],
          },
        ];
      })
      .flat();
  }

  // Definicja dokumentu PDF (docDefinition)
  const docDefinition = {
    // Nagłówek powtarzany na każdej stronie
    header: {
      margin: [0, 15, 0, 10],
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
    content: generateTablesForEntries(filteredData),
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
    pageMargins: [40, 20, 40, 20], // left, top, right, bottom
  };

  // Pobieranie (download) lub otwieranie (open) PDF
  if (download) {
    pdfMake.createPdf(docDefinition).download(`raport_${selectedSection}.pdf`);
  } else {
    pdfMake.createPdf(docDefinition).open();
  }
}
