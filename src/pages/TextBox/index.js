import React from 'react';
import TextBox from '../../components/UI/TextBox'; 

function MyTextBox() { 
  const handleTextChange = (val) => {
    console.log("当前输入框的值是：", val);
  };

  return (
    <div   >
      
       
      <TextBox label="技术栈" onChange={handleTextChange} />
    </div>
  );
}

export default MyTextBox;