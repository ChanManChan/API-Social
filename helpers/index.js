const nodeMailer = require('nodemailer');
const defaultEmailData = { from: 'noreply@nandu-node.com' };

exports.sendEmail = emailData => {
  const transporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: 'ngopal253@gmail.com',
      pass: 'tfklaofdygxmzzvd'
    }
  });
  return transporter
    .sendMail(emailData)
    .then(info => console.log(`Message sent to ${info.response}`))
    .catch(err => console.log(`Problem sending email: ${err}`));
};
