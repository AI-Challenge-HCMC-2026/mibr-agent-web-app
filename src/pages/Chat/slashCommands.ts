export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  queryLabel: string;
  queryPlaceholder: string;
  buildMessage: (query: string) => string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'fts-search',
    name: 'FTS Search',
    description: 'Tìm kiếm toàn văn (Full-Text Search) trên dữ liệu',
    queryLabel: 'Query',
    queryPlaceholder: 'Nhập từ khoá tìm kiếm...',
    buildMessage: (query) =>
      `Hãy sử dụng công cụ fts_search để tìm kiếm danh sách video liên quan nhất cho truy vấn được đính kèm sau đây. Trình bày kết quả dạng bảng với đầy đủ thông tin của video kèm fts score.\n\nTruy vấn: ${query}`,
  },
  {
    id: 'vector-search',
    name: 'Vector-Search',
    description: 'Tìm kiếm ngữ nghĩa (semantic) bằng vector embedding',
    queryLabel: 'Query',
    queryPlaceholder: 'Nhập câu truy vấn ngữ nghĩa...',
    buildMessage: (query) =>
      `Hãy thực hiện tìm kiếm ngữ nghĩa (vector similarity) qua công cụ MCP phù hợp cho truy vấn dưới đây, sau đó tổng hợp các đoạn nội dung liên quan nhất và giải thích ngắn gọn vì sao chúng liên quan.\n\nTruy vấn: ${query}`,
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Tóm tắt nội dung hoặc tài liệu',
    queryLabel: 'Nội dung',
    queryPlaceholder: 'Dán nội dung cần tóm tắt...',
    buildMessage: (query) =>
      `Hãy tóm tắt nội dung sau thành các ý chính ngắn gọn, dễ hiểu, giữ lại thông tin quan trọng nhất.\n\nNội dung:\n${query}`,
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Dịch văn bản sang tiếng Anh',
    queryLabel: 'Văn bản',
    queryPlaceholder: 'Nhập văn bản cần dịch...',
    buildMessage: (query) =>
      `Hãy dịch văn bản sau sang tiếng Anh một cách tự nhiên, chính xác. Chỉ trả về bản dịch.\n\nVăn bản: ${query}`,
  },
];

export const findCommandByName = (name: string): SlashCommand | undefined =>
  SLASH_COMMANDS.find((c) => c.name.toLowerCase() === name.toLowerCase());

export const filterCommands = (query: string): SlashCommand[] => {
  const q = query.toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  );
};
