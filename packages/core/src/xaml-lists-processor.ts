import type { XamlElement } from './xaml-text-formatter.js';

/**
 * Context information for processing nested lists
 */
interface ListContext {
  type: 'ordered' | 'unordered';
  depth: number;
  counter: number;
}

/**
 * Content separation result for ListItem processing
 */
interface ItemContent {
  directContent: XamlElement[];  // Paragraphs, Runs, etc.
  nestedLists: XamlElement[];    // Nested List elements
}

/**
 * Specialized processor for XAML List elements that maintains proper nesting hierarchy.
 * 
 * This class leverages fast-xml-parser's preserveOrder structure to correctly handle
 * nested lists while maintaining proper indentation and markdown formatting.
 */
export class XamlListProcessor {
  private elementProcessor: any; // Reference to XamlElementProcessor

  constructor(elementProcessor: any) {
    this.elementProcessor = elementProcessor;
  }

  /**
   * Main entry point for processing XAML List elements.
   * Replaces the old processList method in the main converter.
   */
  public processListElement(listElement: XamlElement | XamlElement[], depth: number = 0): string {
    const lists = Array.isArray(listElement) ? listElement : [listElement];
    let result = '';

    for (const list of lists) {
      if (!list) continue;

      // Extract list attributes using the converter's helper
      const attrs = this.elementProcessor.textFormatter.getAttributes(list);
      const markerStyle = attrs['@_Kind'] || attrs['@_MarkerStyle'] || 'Disc';
      const listType: 'ordered' | 'unordered' = markerStyle.toLowerCase() === 'decimal' ? 'ordered' : 'unordered';
      
      const context: ListContext = {
        type: listType,
        depth,
        counter: 1
      };

      result += this.processListItems(list, context);
    }

    return result;
  }

  /**
   * Process all ListItem elements within a List, maintaining proper context.
   */
  private processListItems(list: XamlElement, context: ListContext): string {
    let result = '';
    
    // Extract list items using the same logic as the original converter
    const listItems = this.extractListItems(list);
    
    for (const item of listItems) {
      if (!item) continue;
      
      // Process this individual list item
      const itemResult = this.processListItemElement(item, { ...context });
      result += itemResult;
      
      // Increment counter for ordered lists
      if (context.type === 'ordered') {
        context.counter++;
      }
    }

    return result;
  }

  /**
   * Process a single ListItem element, separating direct content from nested lists.
   */
  private processListItemElement(itemElement: XamlElement, context: ListContext): string {
    // Separate the ListItem content into direct content and nested lists
    const { directContent, nestedLists } = this.separateItemContent(itemElement);
    
    // Process the direct content (paragraphs, runs, etc.)
    let contentText = '';
    if (directContent.length > 0) {
      contentText = this.processDirectContent(directContent, context);
    }
    
    // Generate the list marker and indentation
    const indentation = this.getIndentation(context.depth);
    const marker = this.getMarker(context);
    
    // Only create a list item if there's actual content
    // If there's no content but there are nested lists, we'll process those directly
    let result = '';
    if (contentText.trim()) {
      result = `${indentation}${marker}${contentText.trim()}\n`;
    }
    
    // Process any nested lists with incremented depth
    // Instead of processing nested Lists as complete lists, extract their ListItems
    // and process them directly as children of the current item
    if (nestedLists.length > 0) {
      for (const nestedList of nestedLists) {
        // Extract list attributes to determine the list type for nested items
        const attrs = this.elementProcessor.textFormatter.getAttributes(nestedList);
        const markerStyle = attrs['@_Kind'] || attrs['@_MarkerStyle'] || 'Disc';
        const nestedListType: 'ordered' | 'unordered' = markerStyle.toLowerCase() === 'decimal' ? 'ordered' : 'unordered';
        
        // Extract the ListItems from the nested List and process them directly
        const nestedItems = this.extractListItems(nestedList);
        let nestedCounter = 1;
        
        for (const nestedItem of nestedItems) {
          const nestedContext: ListContext = {
            type: nestedListType,
            depth: context.depth + 1,
            counter: nestedCounter
          };
          
          const nestedResult = this.processListItemElement(nestedItem, nestedContext);
          result += nestedResult;
          
          if (nestedListType === 'ordered') {
            nestedCounter++;
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Separate ListItem content into direct content and nested lists.
   * This is crucial for maintaining proper nesting structure.
   */
  private separateItemContent(itemElement: XamlElement): ItemContent {
    const directContent: XamlElement[] = [];
    const nestedLists: XamlElement[] = [];
    
    // Handle preserveOrder structure - ListItem content is typically an array or object
    if (Array.isArray(itemElement)) {
      // If itemElement is an array, process each element
      for (const element of itemElement) {
        this.categorizeElement(element, directContent, nestedLists);
      }
    } else if (typeof itemElement === 'object' && itemElement) {
      // If itemElement is an object, process its properties
      for (const [key, value] of Object.entries(itemElement)) {
        if (key === ':@') continue; // Skip attributes
        
        if (key.toLowerCase() === 'list') {
          // This is a nested list
          const lists = Array.isArray(value) ? value : [value];
          nestedLists.push(...lists);
        } else {
          // This is direct content
          const elements = Array.isArray(value) ? value : [value];
          for (const element of elements) {
            if (element && typeof element === 'object') {
              directContent.push({ [key]: element });
            }
          }
        }
      }
    }
    
    return { directContent, nestedLists };
  }

  /**
   * Categorize a single element as either direct content or nested list.
   */
  private categorizeElement(element: XamlElement, directContent: XamlElement[], nestedLists: XamlElement[]): void {
    if (!element || typeof element !== 'object') return;
    
    for (const [key, value] of Object.entries(element)) {
      if (key === ':@') continue;
      
      if (key.toLowerCase() === 'list') {
        const lists = Array.isArray(value) ? value : [value];
        nestedLists.push(...lists);
      } else {
        directContent.push(element);
        break; // Only process the first non-attribute key for this element
      }
    }
  }

  /**
   * Process direct content (everything except nested Lists) using the main converter.
   */
  private processDirectContent(content: XamlElement[], _context: ListContext): string {
    if (content.length === 0) return '';
    
    let result = '';
    for (const element of content) {
      if (element && typeof element === 'object') {
        // Use the main converter's processElement method for consistency
        result += this.elementProcessor.processElement(element);
      }
    }
    
    return result.trim();
  }

  /**
   * Generate consistent 3-space indentation for all list types.
   */
  private getIndentation(depth: number): string {
    if (depth === 0) return '';
    
    // Always use 3 spaces per level for consistency
    return '   '.repeat(depth);
  }

  /**
   * Generate the appropriate list marker based on context.
   */
  private getMarker(context: ListContext): string {
    if (context.type === 'ordered') {
      return `${context.counter}. `;
    } else {
      return '* '; // Use * for consistency with markdown
    }
  }

  /**
   * Extract list items from a List element - copied from original converter logic.
   */
  private extractListItems(list: XamlElement): XamlElement[] {
    const items: XamlElement[] = [];

    // Handle reconstructed structure from preserveOrder
    if (list.List && Array.isArray(list.List)) {
      for (const item of list.List) {
        if (item.ListItem) {
          if (Array.isArray(item.ListItem)) {
            items.push(...item.ListItem);
          } else {
            items.push(item.ListItem);
          }
        }
      }
    }
    // Handle preserveOrder structure - list content is an array
    else if (Array.isArray(list)) {
      for (const item of list) {
        if (item.ListItem) {
          if (Array.isArray(item.ListItem)) {
            items.push(...item.ListItem);
          } else {
            items.push(item.ListItem);
          }
        }
      }
    } else {
      // Handle old structure
      for (const [key, value] of Object.entries(list)) {
        if (key.toLowerCase() === 'listitem') {
          if (Array.isArray(value)) {
            items.push(...value);
          } else {
            items.push(value);
          }
        }
      }
    }

    return items;
  }
} 