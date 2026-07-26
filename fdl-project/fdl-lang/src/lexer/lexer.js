class Lexer {
  constructor(source) {
    this.source = source;
    this.current = 0;
    this.line = 1;
    this.column = 1;
  }
  peek(){
    return this.source[this.current];
  }
  advance(){
    const pk = this.peek();
    this.current++;
    return pk;
  }
  isAtEnd(){
    return this.current === this.source.length;
  }
  isAlpha(ch){
    return /^[a-zA-Z_]$/.test(ch);
  }
  tokenize() {
    const tokens = [];
    while (!this.isAtEnd()) {
      const ch = this.advance()
      tokens.push(ch);
    }
    return tokens;
  }
}