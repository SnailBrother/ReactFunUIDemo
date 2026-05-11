import React, { useState } from 'react';
import TextBox from '../../components/UI/TextBox';

function MyTextBox() {
  const searchList = ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Node.js', 'JavaScript', 'TypeScript'];
  const [isActive, setIsActive] = useState(true);

  return (
    <div>
      {/* SearchBox 模式 */}

      <TextBox
        label="SearchBox"
        Type="SearchBox"
        searchList={searchList}
        leftIcon="#icon-edit"
        rightIcon="#icon-wrong"
        placeholder="请输入搜索内容"
        onChange={(value) => console.log(value)}
      />

      {/* NumberInput 模式 */}
      <TextBox
        label="NumberInput"
        Type="NumberInput"
        leftIcon="#icon-edit"
        min={-9}
        max={100}
        step={10}
        placeholder="请输入数量的"
        onChange={(value) => console.log(value)}
      />

      {/* DatePicker 模式 */}
      <TextBox
        label="DatePicker"
        Type="DatePicker"
        leftIcon="#icon-edit"
        dateFormat="YYYY年MM月DD日"
        placeholder="请选择日期"
        onChange={(value) => console.log(value)}
      />

      {/* ComboBox 多选框模式 - 可编辑 */}
      <TextBox
        label="ComboBox"
        Type="ComboBox"
        searchList={searchList}
        leftIcon="#icon-unedit"
        rightIcon="#icon-wrong"
        placeholder="请选择或输入多个技术"
        editable={true}
        multiple={true}
        connector="、"
        onChange={(value) => console.log('选中：', value)}
      />
      <TextBox
        label="启用通知"
        Type="Switch"
        value={isActive}
        onChange={(value) => setIsActive(value)}
        leftIcon="#icon-unedit"
        trueLabel="是"
        falseLabel="否"
      />
    </div>
  );
}

export default MyTextBox;