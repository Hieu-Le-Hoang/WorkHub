/**
 * Common utilities for Dataverse API calls
 */

/**
 * Create standard fetch headers for Dataverse API calls
 */
export function createFetchHeaders(accessToken: string): HeadersInit {
    return {
        "Authorization": `Bearer ${accessToken}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Accept": "application/json",
    };
}

/**
 * Create fetch headers with formatted value annotations
 */
export function createFetchHeadersWithAnnotations(accessToken: string): HeadersInit {
    return {
        ...createFetchHeaders(accessToken),
        "Prefer": "odata.include-annotations=\"*\""
    };
}

/**
 * Handle API error responses
 */
export async function handleApiError(response: Response, context: string): Promise<never> {
    const errorText = await response.text();
    console.error(`Error in ${context}:`, response.status, errorText);
    throw new Error(`Dataverse API Error (${response.status}) in ${context}: ${errorText}`);
}

/**
 * Common fetch wrapper with error handling
 */
export async function fetchDataverse<T>(
    url: string,
    accessToken: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = createFetchHeaders(accessToken);
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    if (!response.ok) {
        await handleApiError(response, 'fetchDataverse');
    }

    return response.json();
}

