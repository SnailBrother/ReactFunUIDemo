// 默认格式：YYYY-MM-DD
<DatePicker 
  value={date} 
  onChange={setDate} 
  placeholder="请选择日期"
/>

// 使用斜杠格式：YYYY/MM/DD
<DatePicker 
  value={date} 
  onChange={setDate} 
  format="YYYY/MM/DD"
  placeholder="请选择日期"
/>

// 使用中文格式：YYYY年MM月DD日
<DatePicker 
  value={date} 
  onChange={setDate} 
  format="YYYY年MM月DD日"
  placeholder="请选择日期"
/>