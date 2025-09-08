let configData = null;

// Load configuration on page load
async function loadConfig() {
    try {
        const response = await fetch('/config');
        configData = await response.json();

        // Update page title and header
        const title = `${configData.model_name} API - Model Inference`;
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageHeader').textContent = `${configData.model_name} ${configData.model_version} - Model Inference`;

        // Generate input fields dynamically
        generateInputFields();

        // Enable the inference button
        document.getElementById('inferButton').disabled = false;

    } catch (error) {
        document.getElementById('inputFields').innerHTML = `<div class="error">Failed to load configuration: ${error.message}</div>`;
    }
}

// Generate input fields based on config
function generateInputFields() {
    const inputFieldsContainer = document.getElementById('inputFields');
    let fieldsHtml = '';

    // Check if model has any image inputs or outputs
    const hasImageInput = configData.input_features.some(feature => feature.type === 'image');
    const hasImageOutput = configData.prediction_template.some(feature => feature.type === 'image');
    const hasImages = hasImageInput || hasImageOutput;

    // Create desktop layout with batch and single sections side by side
    if (!hasImages) {
        fieldsHtml += `
            <div class="input-container">
                <div class="batch-section">
                    <h3>Batch Processing (CSV Upload)</h3>
                    <div class="input-group">
                        <label for="csvFile">Upload CSV file for batch inference</label>
                        <input type="file" id="csvFile" accept=".csv" onchange="handleCsvUpload(this)">
                        <div class="csv-info">
                            <p><strong>Required columns:</strong> ${configData.input_features.map(f => f.name).join(', ')}</p>
                            <p>The result will include your input data plus prediction columns: ${configData.prediction_template.map(f => f.name).join(', ')}</p>
                        </div>
                        <button type="button" id="uploadCsvBtn" onclick="uploadCsv()" disabled>Process CSV</button>
                        <div id="csvStatus"></div>
                    </div>
                </div>
                
                <div class="single-section">
                    <h3>Single Inference</h3>
        `;
    }

    // Generate single inference fields
    configData.input_features.forEach(feature => {
        if (feature.type === 'image') {
            fieldsHtml += `
                <div class="input-group">
                    <label for="input_${feature.name}">${feature.name} <span class="type-label">(${feature.type})</span></label>
                    <input type="file" id="input_${feature.name}" accept="image/*" required onchange="previewImage(this, '${feature.name}')">
                    <div class="image-preview-container">
                        <img id="preview_${feature.name}" class="image-preview" alt="Image preview">
                        <br>
                        <button type="button" class="download-btn" id="download_input_${feature.name}" style="display: none;" onclick="downloadImage('preview_${feature.name}', '${feature.name}_input')">Download</button>
                    </div>
                </div>
            `;
        } else {
            const inputType = feature.type === 'string' ? 'text' : 'number';
            const stepAttr = feature.type === 'float' ? 'step="any"' : '';

            fieldsHtml += `
                <div class="input-group">
                    <label for="input_${feature.name}">${feature.name} <span class="type-label">(${feature.type})</span></label>
                    <input type="${inputType}" ${stepAttr} id="input_${feature.name}" value="${feature.value}" required>
                </div>
            `;
        }
    });

    // Close the single section and container if we have the desktop layout
    if (!hasImages) {
        fieldsHtml += `
                </div>
            </div>
        `;
    }

    inputFieldsContainer.innerHTML = fieldsHtml;
}

// Handle CSV file selection
function handleCsvUpload(input) {
    const uploadBtn = document.getElementById('uploadCsvBtn');
    const statusDiv = document.getElementById('csvStatus');
    
    if (input.files && input.files[0]) {
        uploadBtn.disabled = false;
        statusDiv.innerHTML = '<div class="info">CSV file selected. Click "Process CSV" to run batch inference.</div>';
    } else {
        uploadBtn.disabled = true;
        statusDiv.innerHTML = '';
    }
}

// Upload and process CSV
async function uploadCsv() {
    const fileInput = document.getElementById('csvFile');
    const uploadBtn = document.getElementById('uploadCsvBtn');
    const statusDiv = document.getElementById('csvStatus');
    
    if (!fileInput.files || !fileInput.files[0]) {
        statusDiv.innerHTML = '<div class="error">Please select a CSV file first.</div>';
        return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    // Disable button and show loading
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Processing...';
    statusDiv.innerHTML = '<div class="loading">Processing CSV file... This may take a while for large files.</div>';
    
    try {
        const response = await fetch('/infer-csv/', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Get the result as text first to parse and preview
            const csvText = await response.text();
            
            // Show CSV preview with download option
            showCsvPreview(csvText, `predictions_${file.name}`);
            
            statusDiv.innerHTML = '<div class="success">CSV processed successfully! Preview and download available below.</div>';
        } else {
            const errorData = await response.json();
            statusDiv.innerHTML = `<div class="error">Error: ${errorData.detail}</div>`;
        }
    } catch (error) {
        statusDiv.innerHTML = `<div class="error">Network error: ${error.message}</div>`;
    } finally {
        // Re-enable button
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Process CSV';
    }
}

// Global variable to store CSV data for download
let currentCsvData = null;
let currentCsvFilename = null;

// Show CSV preview with download functionality
function showCsvPreview(csvText, filename) {
    currentCsvData = csvText;
    currentCsvFilename = filename;
    
    const output = document.getElementById('output');
    
    // Parse CSV to create table
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
    
    // Limit preview to first 10 rows
    const previewRows = rows.slice(0, 10);
    const totalRows = rows.length;
    
    let tableHtml = `
        <div class="csv-preview-section">
            <div class="csv-preview-header">
                <h3>CSV Results Preview</h3>
                <button type="button" class="download-csv-btn" onclick="downloadCsv()">
                    📥 Download CSV
                </button>
            </div>
            <div class="csv-info-text">
                Showing first ${Math.min(10, totalRows)} of ${totalRows} rows. Total columns: ${headers.length}
            </div>
            <div class="csv-table-container">
                <table class="csv-table">
                    <thead>
                        <tr>
    `;
    
    // Add headers
    headers.forEach(header => {
        tableHtml += `<th>${escapeHtml(header)}</th>`;
    });
    
    tableHtml += `
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Add preview rows
    previewRows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
            tableHtml += `<td>${escapeHtml(cell)}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    output.innerHTML = tableHtml;
}

// Download CSV function
function downloadCsv() {
    if (!currentCsvData || !currentCsvFilename) {
        alert('No CSV data available for download');
        return;
    }
    
    const blob = new Blob([currentCsvData], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentCsvFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Preview uploaded image
function previewImage(input, featureName) {
    const preview = document.getElementById(`preview_${featureName}`);
    const downloadBtn = document.getElementById(`download_input_${featureName}`);

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            downloadBtn.style.display = 'inline-block';
        };

        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
        downloadBtn.style.display = 'none';
    }
}

// Download image function
function downloadImage(imageId, filename) {
    const image = document.getElementById(imageId);
    if (!image || !image.src) {
        alert('No image to download');
        return;
    }

    // Create download link
    const link = document.createElement('a');
    link.href = image.src;
    link.download = `${filename}.jpg`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Convert image to base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data:image/...;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Collect input data dynamically
async function collectInputData() {
    const promises = configData.input_features.map(async feature => {
        const element = document.getElementById(`input_${feature.name}`);
        let value;

        // Convert value based on type
        if (feature.type === 'image') {
            if (element.files && element.files[0]) {
                value = await imageToBase64(element.files[0]);
            } else {
                throw new Error(`Please select an image for ${feature.name}`);
            }
        } else if (feature.type === 'int') {
            value = parseInt(element.value);
        } else if (feature.type === 'float') {
            value = parseFloat(element.value);
        } else {
            value = element.value;
        }

        return {
            name: feature.name,
            value: value,
            type: feature.type
        };
    });

    return await Promise.all(promises);
}

document.getElementById('inferenceForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const button = document.getElementById('inferButton');
    const output = document.getElementById('output');

    // Disable button and show loading
    button.disabled = true;
    button.textContent = 'Running...';
    output.innerHTML = '<div class="loading">Processing inference...</div>';

    try {
        // Collect input data dynamically
        const modelInput = await collectInputData();

        // Send request to inference endpoint
        const response = await fetch('/infer/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model_input: modelInput })
        });

        const result = await response.json();

        if (response.ok) {
            // Display success results
            let resultHtml = `<div class="success">Inference completed successfully in ${result.duration.toFixed(3)} seconds</div>`;
            resultHtml += '<h3>Output:</h3>';

            result.results.forEach((item, index) => {
                if (item.type === 'image') {
                    // Display image from base64 with download button
                    const imageId = `result_image_${index}`;
                    resultHtml += `
                                <div class="result-item">
                                    <strong>${item.name}</strong> (${item.type}):
                                    <br>
                                    <div class="image-result-container">
                                        <img id="${imageId}" src="data:image/jpeg;base64,${item.value}" class="image-result" alt="Result image">
                                        <br>
                                        <button type="button" class="download-btn" onclick="downloadImage('${imageId}', '${item.name}_output')">Download</button>
                                    </div>
                                </div>
                            `;
                } else {
                    resultHtml += `
                                <div class="result-item">
                                    <strong>${item.name}</strong> (${item.type}): ${item.value}
                                </div>
                            `;
                }
            });

            output.innerHTML = resultHtml;
        } else {
            // Display error
            output.innerHTML = `<div class="error">Error: ${result.detail}</div>`;
        }

    } catch (error) {
        output.innerHTML = `<div class="error">Network error: ${error.message}</div>`;
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = 'Run Inference';
    }
});

// Load configuration when page loads
window.addEventListener('load', loadConfig);