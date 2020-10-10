import {DataFactory, Literal, Quad_Graph, Quad_Object, Quad_Predicate, Quad_Subject, Term,} from 'rdf-js';
import {
  TSBinding,
  TSPattern, TSProjectSearchStage,
  TSQuad,
  TSRange,
  TSRdfBinding,
  TSRdfPattern,
  TSRdfPrefixes,
  TSRdfQuad,
  TSRdfRange,
  TSRdfSearchStage,
  TSRdfSimplePattern,
  TSSearchStage,
  TSSearchStageType,
  TSSimplePattern,
} from '../types/index.js';
import {fpstringEncode} from './fpstring.js';

const xsd = 'http://www.w3.org/2001/XMLSchema#';

const xsdString  = xsd + 'string';
const rdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

const xsdDateTime = xsd + 'dateTime';
const xsdBoolean = xsd + 'boolean';

const xsdInteger = xsd + 'integer';
const xsdDecimal = xsd + 'decimal';
const xsdDouble = xsd + 'double';
const xsdNonPositiveInteger = xsd + 'nonPositiveInteger';
const xsdNegativeInteger = xsd + 'negativeInteger';
const xsdLong = xsd + 'long';
const xsdInt = xsd + 'int';
const xsdShort = xsd + 'short';
const xsdByte = xsd + 'byte';
const xsdNonNegativeInteger = xsd + 'nonNegativeInteger';
const xsdUnsignedLong = xsd + 'unsignedLong';
const xsdUnsignedInt = xsd + 'unsignedInt';
const xsdUnsignedShort = xsd + 'unsignedShort';
const xsdUnsignedByte = xsd + 'unsignedByte';
const xsdPositiveInteger = xsd + 'positiveInteger';

export class RdfSerialization {
  constructor(readonly prefixes: TSRdfPrefixes) {
  }

  exportLiteralTerm = (term: string, dataFactory: DataFactory): Literal => {
    const [, , datatype, language, value] = term.split('\u0001');
    const datatypeIri = this.expandRequiredTerm(datatype);
    switch (datatypeIri) {
      case rdfLangString:
        if (language !== '') {
          return dataFactory.literal(value, language);
        }
        return dataFactory.literal(value);
      default:
        return dataFactory.literal(value, dataFactory.namedNode(datatypeIri));
    }
  }

  importLiteralTerm = (term: Literal, rangeBoundary = false): string => {
    const { language, datatype, value } = term;
    if (language !== '') {
      return `\u0001\u0001${rdfLangString}\u0001${language}\u0001${value}`;
    }
    if (!datatype || datatype.value === xsdString) {
      return `\u0001\u0001${xsdString}\u0001\u0001${value}`;
    }
    const datatypeTerm = this.prefixes.compactIri(datatype.value);
    switch (datatype.value) {
      case xsdInteger:
      case xsdDouble:
      case xsdDecimal:
      case xsdNonPositiveInteger:
      case xsdNegativeInteger:
      case xsdLong:
      case xsdInt:
      case xsdShort:
      case xsdByte:
      case xsdNonNegativeInteger:
      case xsdUnsignedLong:
      case xsdUnsignedInt:
      case xsdUnsignedShort:
      case xsdUnsignedByte:
      case xsdPositiveInteger:
        if (rangeBoundary) {
          return `\u0001number:${fpstringEncode(value)}\u0001`;
        }
        return `\u0001number:${fpstringEncode(value)}\u0001${datatypeTerm}\u0001\u0001${value}\u0001`;
      case xsdDateTime:
        const timestamp = new Date(value).valueOf();
        if (rangeBoundary) {
          return `\u0001datetime:${fpstringEncode(timestamp)}`;
        }
        return `\u0001datetime:${fpstringEncode(timestamp)}\u0001${datatypeTerm}\u0001\u0001${value}\u0001`;
      default:
        return `\u0001\u0001${datatypeTerm}\u0001\u0001${value}\u0001`;
    }
  }

  exportTerm = (term: string, isGraph: boolean, defaultGraphValue: string, dataFactory: DataFactory): Term => {
    if (!term) {
      throw new Error(`Nil term "${term}". Cannot export.`);
    }
    if (term === defaultGraphValue) {
      return dataFactory.defaultGraph();
    }
    switch (term[0]) {
      case '_':
        return dataFactory.blankNode(term.substr(2));
      case '?':
        if (dataFactory.variable) {
          return dataFactory.variable(term.substr(1));
        }
        throw new Error('DataFactory does not support variables');
      case '\u0001':
        if (isGraph) {
          throw new Error(`Invalid graph term "${term}" (graph cannot be a literal).`);
        }
        return this.exportLiteralTerm(term, dataFactory);
      default:
        return dataFactory.namedNode(this.expandRequiredTerm(term));
    }
  }

  importSimpleTerm = (term: Term, isGraph: boolean, defaultGraphValue: string, rangeBoundary: boolean = false): string => {
    if (!term) {
      if (isGraph) {
        return defaultGraphValue;
      }
      throw new Error(`Nil non-graph term, cannot import.`);
    }
    switch (term.termType) {
      case 'NamedNode':
        return this.prefixes.compactIri(term.value);
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Variable':
        return `?${term.value}`;
      case 'DefaultGraph':
        return defaultGraphValue;
      case 'Literal':
        return this.importLiteralTerm(term, rangeBoundary);
      default:
        // @ts-ignore
        throw new Error(`Unexpected termType: "${term.termType}".`);
    }
  }

  importRange = (range: TSRdfRange, rangeBoundary: boolean = false): TSRange => {
    const importedRange: TSRange = {};
    if (range.lt) importedRange.lt = this.importLiteralTerm(range.lt, rangeBoundary);
    if (range.lte) importedRange.lte = this.importLiteralTerm(range.lte, rangeBoundary);
    if (range.gt) importedRange.gt = this.importLiteralTerm(range.gt, rangeBoundary);
    if (range.gte) importedRange.gte = this.importLiteralTerm(range.gte, rangeBoundary);
    return importedRange;
  }

  importTerm = (term: Term | TSRdfRange, isGraph: boolean, defaultGraphValue: string, rangeBoundary: boolean = false): string | TSRange => {
    if ('termType' in term) {
      switch (term.termType) {
        case 'NamedNode':
          return this.prefixes.compactIri(term.value);
        case 'BlankNode':
          return '_:' + term.value;
        case 'Variable':
          return '?' + term.value;
        case 'DefaultGraph':
          return defaultGraphValue;
        case 'Literal':
          return this.importLiteralTerm(term, rangeBoundary);
        default:
          // @ts-ignore
          throw new Error(`Unexpected termType: "${term.termType}".`);
      }
    } else if ('gt' in term || 'gte' in term || 'lt' in term || 'lte' in term) {
      return this.importRange(term, rangeBoundary);
    } else {
      throw new Error(`Unexpected type of "term" argument.`);
    }
  }

  importQuad = (quad: TSRdfQuad, defaultGraphValue: string): TSQuad => {
    return {
      subject: this.importSimpleTerm(quad.subject, false, defaultGraphValue),
      predicate: this.importSimpleTerm(quad.predicate, false, defaultGraphValue),
      object: this.importSimpleTerm(quad.object, false, defaultGraphValue),
      graph: this.importSimpleTerm(quad.graph, true, defaultGraphValue),
    };
  }

  private exportQuadSubject = (term: string, dataFactory: DataFactory): Quad_Subject => {
    switch (term[0]) {
      case '_':
        return dataFactory.blankNode(term.substr(2));
      case '?':
        if (dataFactory.variable) {
          return dataFactory.variable(term.substr(1));
        }
        throw new Error('DataFactory does not support variables');
      case '\u0001':
        throw new Error('No literals as subject');
      default:
        return dataFactory.namedNode(this.expandRequiredTerm(term));
    }
  }

  private exportQuadPredicate = (term: string, dataFactory: DataFactory): Quad_Predicate => {
    switch (term[0]) {
      case '_':
        throw new Error('No blank nodes as predicates');
      case '?':
        if (dataFactory.variable) {
          return dataFactory.variable(term.substr(1));
        }
        throw new Error('DataFactory does not support variables');
      case '\u0001':
        throw new Error('No literals as predicates');
      default:
        return dataFactory.namedNode(this.expandRequiredTerm(term));
    }
  }

  private exportQuadObject = (term: string, dataFactory: DataFactory): Quad_Object => {
    switch (term[0]) {
      case '_':
        return dataFactory.blankNode(term.substr(2));
      case '?':
        if (dataFactory.variable) {
          return dataFactory.variable(term.substr(1));
        }
        throw new Error('DataFactory does not support variables');
      case '\u0001':
        return this.exportLiteralTerm(term, dataFactory);
      default:
        return dataFactory.namedNode(this.expandRequiredTerm(term));
    }
  }

  private exportQuadGraph = (term: string, defaultGraphValue: string, dataFactory: DataFactory): Quad_Graph => {
    if (term === defaultGraphValue) {
      return dataFactory.defaultGraph();
    }
    switch (term[0]) {
      case '_':
        return dataFactory.blankNode(term.substr(2));
      case '?':
        if (dataFactory.variable) {
          return dataFactory.variable(term.substr(1));
        }
        throw new Error('DataFactory does not support variables');
      case '\u0001':
        throw new Error('No literals as graphs');
      default:
        return dataFactory.namedNode(this.expandRequiredTerm(term));
    }
  }

  exportQuad = (quad: TSQuad, defaultGraphValue: string, dataFactory: DataFactory): TSRdfQuad => {
    return dataFactory.quad(
      this.exportQuadSubject(quad.subject, dataFactory),
      this.exportQuadPredicate(quad.predicate, dataFactory),
      this.exportQuadObject(quad.object, dataFactory),
      this.exportQuadGraph(quad.graph, defaultGraphValue, dataFactory)
    );
  };

  exportBinding = (binding: TSBinding, defaultGraphValue: string, dataFactory: DataFactory): TSRdfBinding => {
    const exportedBinding: TSRdfBinding = Object.create(null);
    for (let k = 0, keys = Object.keys(binding), key; k < keys.length; k += 1) {
      key = keys[k];
      exportedBinding[key] = this.exportTerm(binding[key], false, defaultGraphValue, dataFactory);
    }
    return exportedBinding;
  };

  importPattern = (terms: TSRdfPattern, defaultGraph: string): TSPattern => {
    const importedTerms: TSPattern = {};
    if (terms.subject) {
      importedTerms.subject = this.importTerm(terms.subject, false, defaultGraph, true);
    }
    if (terms.predicate) {
      importedTerms.predicate = this.importTerm(terms.predicate, false, defaultGraph, true);
    }
    if (terms.object) {
      importedTerms.object = this.importTerm(terms.object, false, defaultGraph, true);
    }
    if (terms.graph) {
      importedTerms.graph = this.importTerm(terms.graph, true, defaultGraph, true);
    }
    return importedTerms;
  };

  importSimplePattern = (terms: TSRdfSimplePattern, defaultGraph: string): TSSimplePattern => {
    const importedPattern: TSSimplePattern = {};
    if (terms.subject) {
      importedPattern.subject = this.importSimpleTerm(terms.subject, false, defaultGraph);
    }
    if (terms.predicate) {
      importedPattern.predicate = this.importSimpleTerm(terms.predicate, false, defaultGraph);
    }
    if (terms.object) {
      importedPattern.object = this.importSimpleTerm(terms.object, false, defaultGraph);
    }
    if (terms.graph) {
      importedPattern.graph = this.importSimpleTerm(terms.graph, true, defaultGraph);
    }
    return importedPattern;
  };

  importSearchStage = (stage: TSRdfSearchStage, defaultGraph: string): TSSearchStage => {
    switch (stage.type) {
      case TSSearchStageType.BGP:
        return { ...stage, pattern: this.importSimplePattern(stage.pattern, defaultGraph) };
      case TSSearchStageType.LT:
      case TSSearchStageType.LTE:
      case TSSearchStageType.GT:
      case TSSearchStageType.GTE:
      case TSSearchStageType.STARTS_WITH:
      case TSSearchStageType.STARTS_WITHOUT:
        return {
          type: stage.type,
          args: stage.args.map(arg => this.importSimpleTerm(arg, false, defaultGraph, true)),
        };
      case TSSearchStageType.EQ:
        return {
          type: TSSearchStageType.STARTS_WITH,
          args: stage.args.map(arg => this.importSimpleTerm(arg, false, defaultGraph, true)),
        };
      case TSSearchStageType.NEQ:
        return {
          type: TSSearchStageType.STARTS_WITHOUT,
          args: stage.args.map(arg => this.importSimpleTerm(arg, false, defaultGraph, true)),
        };
      case TSSearchStageType.CONSTRUCT:
        return {
          type: stage.type,
          patterns: stage.patterns.map(pattern => this.importSimplePattern(pattern, defaultGraph)),
        };
      case TSSearchStageType.PROJECT:
        return <TSProjectSearchStage>stage;
    }
  }

  private expandRequiredTerm(term: string): string {
    const requiredTerm = this.prefixes.expandTerm(term);
    if (!requiredTerm) {
      throw new Error(`Term "${term}" is disabled. Cannot export.`);
    }
    return requiredTerm;
  }
}
