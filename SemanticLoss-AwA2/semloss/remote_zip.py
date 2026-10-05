"""Read selected members of a large remote zip with HTTP range requests (no full download).

A zip keeps its central directory at the end, so `zipfile` only needs a seekable file object: this one
fetches the byte ranges it is asked for. Used to extract five AwA2 classes from the 13.9 GB AwA2-data.zip.
"""
import io
import urllib.request
import zipfile


class HTTPRangeFile(io.RawIOBase):
    def __init__(self, url, block=1 << 20):
        self.url, self.block, self.pos = url, block, 0
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req) as r:
            self.size = int(r.headers["Content-Length"])
            if r.headers.get("Accept-Ranges") != "bytes":
                raise RuntimeError("server does not support range requests")
        self._cache = {}

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=io.SEEK_SET):
        self.pos = {io.SEEK_SET: offset, io.SEEK_CUR: self.pos + offset, io.SEEK_END: self.size + offset}[whence]
        return self.pos

    def _fetch(self, start, end):
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={start}-{end - 1}"})
        with urllib.request.urlopen(req) as r:
            return r.read()

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0:
            return b""
        if n > self.block:  # large reads (file bodies) go straight to the server
            data = self._fetch(self.pos, self.pos + n)
        else:  # small reads (headers, central directory) are served from 1 MB cached blocks
            out = bytearray()
            p = self.pos
            while len(out) < n:
                b = p // self.block
                if b not in self._cache:
                    self._cache = {b: self._fetch(b * self.block, min((b + 1) * self.block, self.size))} | dict(list(self._cache.items())[-7:])
                chunk = self._cache[b][p - b * self.block:]
                take = min(len(chunk), n - len(out))
                out += chunk[:take]
                p += take
            data = bytes(out)
        self.pos += len(data)
        return data

    def readinto(self, buf):
        data = self.read(len(buf))
        buf[:len(data)] = data
        return len(data)


def open_remote_zip(url):
    return zipfile.ZipFile(io.BufferedReader(HTTPRangeFile(url), buffer_size=1 << 16))
