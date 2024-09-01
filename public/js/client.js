class FigmaAnalyzer extends Base {
  constructor() {
    super();
    this.fullAnalysis = null;
    this.token = "";
    this.fileKey = "";
    this.templateData = {};
    this.$resultsHeader = null;
    this.$resultsContent = null;
    this.$loader = null;
    this.$download = null;
    this.$filter = null;
    this.$sortSelect = null;
    this.currentSort = "count";

    this.TYPES = {
      ALL: "All types",
      COMPONENT: "COMPONENT",
      INSTANCE: "INSTANCE",
      VARIANT: "VARIANT",
    };
    this.currentFilter = this.TYPES.ALL;
  }

  bindEvents() {
    document
      .getElementById("apiForm")
      .addEventListener("submit", (e) => this.onSubmit(e));
    document
      .getElementById("downloadBtn")
      .addEventListener("click", (e) => this.onDownload(e));
  }

  template() {
    return `
      <div class="Form">
        <h2>Figma<br />Components<br />Analyzer</h2>
        <form id="apiForm">
          <input type="text" id="token" placeholder="Figma Personal Access Token" required>
          <input type="text" id="fileKey" placeholder="Figma File Key" required>
          <div class="Form__buttons">
            <button type="submit">Analyze</button>
            <div class="Download" id="download" style="display: none;">
              <button id="downloadBtn" class="is-secondary">Download analysis</button>
            </div>
          </div>
        </form>
      </div>
      <div class="Results js-results">
        <div class="Results__header js-results-header"></div>
        <div class="Results__content js-results-content"></div>
        <div class="Results__loader js-results-loader">Analyzing…</div>
      </div>
    `;
  }

  saveToLocalStorage(token, fileKey) {
    localStorage.setItem("figmaToken", token);
    localStorage.setItem("figmaFileKey", fileKey);
  }

  loadFromLocalStorage() {
    this.token = localStorage.getItem("figmaToken") || "";
    this.fileKey = localStorage.getItem("figmaFileKey") || "";
    document.getElementById("token").value = this.token;
    document.getElementById("fileKey").value = this.fileKey;
  }

  createPropertyElements(analysis) {
    return analysis.map((propertyData) => {
      // Sort values alphabetically
      propertyData.values = propertyData.values.sort((a, b) =>
        a.localeCompare(b),
      );

      const property = new Property(propertyData, this.fileKey);
      return property.render();
    });
  }

  displayResultsContent() {
    this.$resultsContent.innerHTML = "";

    let filteredAnalysis =
      this.currentFilter === this.TYPES.ALL
        ? this.fullAnalysis
        : this.fullAnalysis.filter((prop) => prop.type === this.currentFilter);

    // Sort the properties
    filteredAnalysis = this.sortProperties(filteredAnalysis);

    const propertyElements = this.createPropertyElements(filteredAnalysis);
    propertyElements.forEach((element) => {
      this.$resultsContent.appendChild(element);
    });
  }

  sortProperties(properties) {
    if (this.currentSort === "alphabetical") {
      return properties.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return properties.sort((a, b) => b.count - a.count);
    }
  }

  createSortSelect() {
    const $select = this.createElement({
      elementType: "select",
      className: "Sort",
      id: "sort",
    });

    const options = [
      { value: "count", text: "Sort by count" },
      { value: "alphabetical", text: "Sort alphabetically" },
    ];

    options.forEach(({ value, text }) => {
      const $option = this.createElement({
        elementType: "option",
        value,
        text,
      });
      $select.appendChild($option);
    });

    return $select;
  }

  onSortChange(e) {
    this.currentSort = e.target.value;
    this.displayResultsContent();
  }

  formatAnalysisResults(analysis) {
    return analysis
      .map((propertyData) => {
        const property = new Property(propertyData, this.fileKey);
        return property.render().outerHTML;
      })
      .join("");
  }

  async onSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    this.updateTokenAndFileKey();
    this.saveToLocalStorage(this.token, this.fileKey);

    this.resetUI();
    this.showLoader();

    try {
      await this.fetchAndAnalyzeComponents();
      this.displayResults();
    } catch (error) {
      this.displayError(error);
    }
  }

  updateTokenAndFileKey() {
    this.token = document.getElementById("token").value;
    this.fileKey = document.getElementById("fileKey").value;
  }

  resetUI() {
    this.$resultsHeader.classList.remove("is-visible");
    this.$resultsHeader.innerHTML = "";
    this.$resultsContent.innerHTML = "";
    this.$download.style.display = "none";
  }

  showLoader() {
    this.$loader.classList.add("is-visible");
  }

  hideLoader() {
    this.$loader.classList.remove("is-visible");
  }

  async fetchAndAnalyzeComponents() {
    const library = new Library(this.token, this.fileKey);
    const document = await library.fetch();
    this.name = document.name;
    this.lastModified = document.lastModified;
    this.fullAnalysis = library.analyzeComponentNames(document.properties);
  }

  displayResults() {
    this.hideLoader();
    this.displayResultsHeader();
    this.displayResultsContent();
    this.$download.style.display = "block";
  }

  displayResultsHeader() {
    this.$resultsHeader.classList.add("is-visible");

    const $title = this.createElement({
      elementType: "h2",
      className: "ResultsHeader__title",
      text: this.name,
    });

    const componentsList = Object.values(this.fullAnalysis);
    const componentsLabel =
      componentsList.length > 1 ? "components" : "component";
    const $info = this.createElement({
      className: "ResultsHeader__info",
      text: `${this.fullAnalysis.length} properties found in ${componentsList.length} ${componentsLabel}`,
    });

    const $filter = this.createTypeFilter();
    const $sortSelect = this.createSortSelect();

    const $resultsHeaderLeft = this.createElement({
      elementType: "div",
      className: "ResultsHeader__left",
    });

    const $resultsHeaderOptions = this.createElement({
      elementType: "div",
      className: "Results__headerOptions",
    });

    $resultsHeaderLeft.appendChild($title);
    $resultsHeaderLeft.appendChild($info);
    $resultsHeaderOptions.appendChild($filter);
    $resultsHeaderOptions.appendChild($sortSelect);

    this.$resultsHeader.appendChild($resultsHeaderLeft);
    this.$resultsHeader.appendChild($resultsHeaderOptions);

    $filter.addEventListener("change", (e) => this.onTypeFilterChange(e));
    $sortSelect.addEventListener("change", (e) => this.onSortChange(e));
  }

  createTypeFilter() {
    const types = [
      this.TYPES.ALL,
      ...new Set(this.fullAnalysis.map((prop) => prop.type)),
    ];

    const $select = this.createElement({
      elementType: "select",
      className: "Filter",
      id: "filter",
    });

    types.forEach((value) => {
      const text = value.replace(/_/g, " ");

      const $option = this.createElement({
        elementType: "option",
        value,
        text,
      });

      $select.appendChild($option);
    });

    return $select;
  }

  onTypeFilterChange(e) {
    this.currentFilter = e.target.value;
    this.displayResultsContent();
  }

  displayError(error) {
    this.hideLoader();
    this.$results.classList.add("has-error");
    this.$resultsContent.textContent = `Error: ${error.message}`;
  }

  onDownload(e) {
    e.preventDefault();
    e.stopPropagation();

    if (this.fullAnalysis) {
      const blob = new Blob([JSON.stringify(this.fullAnalysis, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "figma_analysis.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  addPropertyClickListeners() {
    const properties = this.$el.querySelectorAll(".Property");
    properties.forEach((property) => {
      property.addEventListener("click", (e) => {
        if (e.target.tagName === "A") {
          return;
        }

        const componentsDiv = property.querySelector(".Property__components");
        if (componentsDiv) {
          componentsDiv.classList.toggle("is-open");
          property.classList.toggle("is-open");
        }
      });
    });
  }

  init() {
    this.bindEvents();
    this.loadFromLocalStorage();
  }

  render() {
    this.renderTemplate();
    this.$results = this.$el.querySelector(".js-results");
    this.$resultsHeader = this.$el.querySelector(".js-results-header");
    this.$resultsContent = this.$el.querySelector(".js-results-content");
    this.$loader = this.$el.querySelector(".js-results-loader");
    this.$download = this.$el.querySelector("#download");

    return this.$el;
  }
}

window.onload = () => {
  const analyzer = new FigmaAnalyzer();
  document.body.appendChild(analyzer.render());
  analyzer.init();
};
