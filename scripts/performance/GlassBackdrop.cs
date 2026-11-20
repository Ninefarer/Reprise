using System;
using System.Drawing;
using System.Windows.Forms;
public class GlassBackground : Form {
 string mode="Bright";
 public GlassBackground() {
  Text="Reprise Controlled Background"; StartPosition=FormStartPosition.Manual; Bounds=Screen.PrimaryScreen.Bounds; BackColor=Color.White; DoubleBuffered=true;
  var panel=new FlowLayoutPanel {Dock=DockStyle.Top, Height=45, BackColor=Color.Gray};
  foreach (var name in new[]{"Bright","Dark","Contrast"}) {
   var b=new Button {Text=name,Height=36};
   b.Click+=(s,e)=>{mode=((Button)s).Text; BackColor=mode=="Dark"?Color.FromArgb(8,8,8):Color.White; Invalidate();}; panel.Controls.Add(b);
  } Controls.Add(panel);
 }
 protected override void OnPaint(PaintEventArgs e) {
  base.OnPaint(e); if(mode!="Contrast") return;
  for(int x=0;x<ClientSize.Width;x+=64) for(int y=0;y<ClientSize.Height;y+=64)
   if((x/64+y/64)%2==0) e.Graphics.FillRectangle(Brushes.Black,x,y,64,64);
 }
 [STAThread] public static void Main() {Application.EnableVisualStyles(); Application.Run(new GlassBackground());}
}
