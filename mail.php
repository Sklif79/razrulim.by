<?php

if(!empty($_POST) && $_POST['site'] == ''){		
	
	require 'phpmailer/PHPMailerAutoload.php';
	$mail = new PHPMailer;
	$mail->setFrom('2232785@gmail.com', 'razrulim.by');
	$mail->addAddress('betyr1@mail.ru', 'razrulim.by');
	$mail->Subject = 'Заявка с сайта';	
	$mail->CharSet = 'UTF-8';
	$mail->Body = 'Телефон: '.$_POST['phone'];	
	
	// if($data->email || $data->name || $data->question){
		// $mail->AltBody .= 'email: '.$data->phone;
		// $mail->AltBody .= 'Имя: '.$data->name;
		// $mail->AltBody .= 'Вопрос: '.$data->question;
	// }
	
	
	if (!$mail->send()) {
		echo 'false';
	} else {
		echo 'true';
	}
	
}else{	
	return false;
}
