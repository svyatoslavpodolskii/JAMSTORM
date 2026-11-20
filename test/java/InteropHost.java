import java.net.*;
import java.util.Base64;
import app.morphe.jam.companion.SecureChannel;

/** Test harness around the actual, unmodified upstream Android channel class. */
public class InteropHost {
  public static void main(String[] args) throws Exception {
    if (args.length == 3) {
      try (Socket socket = new Socket("127.0.0.1", Integer.parseInt(args[2])); SecureChannel channel = new SecureChannel(socket, false, args[0], Base64.getUrlDecoder().decode(args[1]), "00112233-4455-6677-8899-aabbccddeeff")) {
        channel.send("{\"op\":\"SYNC\",\"revision\":\"\"}");
        String reply = channel.receive();
        if (!reply.equals("{\"ok\":true,\"items\":[]}")) throw new IllegalStateException("Wrong reply");
        System.out.println("JAVA_CLIENT_OK");
      }
      return;
    }
    try (ServerSocket listener = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
      System.out.println(listener.getLocalPort()); System.out.flush();
      try (Socket socket = listener.accept(); SecureChannel channel = new SecureChannel(socket, true, args[0], Base64.getUrlDecoder().decode(args[1]), null)) {
        for (int i = 0; i < 3; i++) channel.send(channel.receive());
      }
    }
  }
}
