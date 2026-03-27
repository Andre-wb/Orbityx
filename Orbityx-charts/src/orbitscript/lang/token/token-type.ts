export type TokenType =
    // Literals
    | 'NUMBER' | 'STRING' | 'BOOL' | 'COLOR'
    // Identifier / keywords
    | 'IDENT'
    | 'FN' | 'LET' | 'MUT' | 'STRUCT' | 'ENUM' | 'IMPL' | 'TRAIT'
    | 'FOR' | 'IN' | 'WHILE' | 'LOOP' | 'IF' | 'ELSE' | 'MATCH'
    | 'RETURN' | 'BREAK' | 'CONTINUE'
    | 'SELF' | 'PUB'
    | 'TRUE' | 'FALSE'
    | 'SOME' | 'NONE' | 'OK' | 'ERR'
    // Types keywords
    | 'F64' | 'I64' | 'BOOL_TY' | 'STR_TY' | 'COLOR_TY' | 'SERIES_TY'
    | 'OPTION_TY' | 'RESULT_TY' | 'VOID_TY'
    // Operators
    | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'STAR_STAR'
    | 'PLUS_EQ' | 'MINUS_EQ' | 'STAR_EQ' | 'SLASH_EQ' | 'PERCENT_EQ'
    | 'AMP_AMP' | 'PIPE_PIPE' | 'BANG'
    | 'EQ_EQ' | 'BANG_EQ' | 'LT' | 'GT' | 'LT_EQ' | 'GT_EQ'
    | 'EQ' | 'FAT_ARROW' | 'ARROW' | 'DOUBLE_COLON' | 'DOT' | 'DOT_DOT'
    | 'QUESTION'
    // Delimiters
    | 'LPAREN' | 'RPAREN'
    | 'LBRACE' | 'RBRACE'
    | 'LBRACKET' | 'RBRACKET'
    | 'COMMA' | 'COLON' | 'SEMICOLON'
    // Rust attribute  #[
    | 'HASH_BRACKET'
    // Closure param delimiters
    | 'PIPE'
    // Reference
    | 'AMP'
    | 'UNDERSCORE'
    | 'EOF';
