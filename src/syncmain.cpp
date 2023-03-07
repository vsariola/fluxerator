// minify windows.h
#pragma warning(disable : 6031 6387)
#define WIN32_LEAN_AND_MEAN
#define WIN32_EXTRA_LEAN
#define VC_LEANMEAN
#define VC_EXTRALEAN
#include <windows.h>
#include <mmsystem.h>
#include <mmreg.h>
#include <dsound.h>
#include <GL/gl.h>
#include <stdio.h>

// Defining OPENGL_DEBUG makes the CHECK_ERRORS() macro show the error code in messagebox.
// Without the macro, CHECK_ERRORS() is a nop.
#include "debug.h"

#include "glext.h"
#include "4klang.h"
#include <shader.inl>
#include "../extern/rocket/lib/sync.h"
#include <minirocket_tracknames.h>

#define sizeof_array(array) (int)(sizeof(array) / sizeof(array[0]))

static struct sync_device *device;
static struct sync_cb cb;

static const PIXELFORMATDESCRIPTOR pfd = {
	sizeof(pfd), 1, PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER, PFD_TYPE_RGBA,
	32, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 32, 0, 0, PFD_MAIN_PLANE, 0, 0, 0, 0};

static DEVMODE screenSettings = {
	{0}, 0, 0, sizeof(screenSettings), 0, DM_PELSWIDTH | DM_PELSHEIGHT, {0}, 0, 0, 0, 0, 0, {0}, 0, 0, XRES, YRES, 0, 0,
#if (WINVER >= 0x0400)
	0,
	0,
	0,
	0,
	0,
	0,
#if (WINVER >= 0x0500) || (_WIN32_WINNT >= 0x0400)
	0,
	0
#endif
#endif
};

static WAVEFORMATEX WaveFMT =
	{
#ifdef FLOAT_32BIT
		WAVE_FORMAT_IEEE_FLOAT,
#else
		WAVE_FORMAT_PCM,
#endif
		2,									   // channels
		SAMPLE_RATE,						   // samples per sec
		SAMPLE_RATE * sizeof(SAMPLE_TYPE) * 2, // bytes per sec
		sizeof(SAMPLE_TYPE) * 2,			   // block alignment;
		sizeof(SAMPLE_TYPE) * 8,			   // bits per sample
		0									   // extension not needed
};

static DSBUFFERDESC bufferDesc = {sizeof(DSBUFFERDESC), DSBCAPS_GETCURRENTPOSITION2 | DSBCAPS_GLOBALFOCUS | DSBCAPS_TRUEPLAYPOSITION, 2 * MAX_SAMPLES * sizeof(SAMPLE_TYPE), NULL, &WaveFMT, NULL};

// static allocation saves a few bytes
static int pidMain;

LPDIRECTSOUNDBUFFER buf;

static void xpause(void *data, int flag)
{
	(void)data;

	if (flag)
		buf->Stop();
	else
		buf->Play(0, 0, 0);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

static void xset_row(void *data, int row)
{
	DWORD newpos = row * 2 * SAMPLES_PER_TICK * sizeof(SAMPLE_TYPE);
	buf->SetCurrentPosition(newpos);
	(void)data;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

static int xis_playing(void *data)
{
	(void)data;
	DWORD playStatus;
	buf->GetStatus(&playStatus);
	return playStatus & DSBSTATUS_PLAYING == DSBSTATUS_PLAYING;
}

int rocket_init(const char *prefix)
{
	device = sync_create_device(prefix);
	if (!device)
	{
		printf("Unable to create rocketDevice\n");
		return 0;
	}

	cb.is_playing = xis_playing;
	cb.pause = xpause;
	cb.set_row = xset_row;

	if (sync_tcp_connect(device, "localhost", SYNC_DEFAULT_PORT))
	{
		printf("Rocket failed to connect\n");
		return 0;
	}

	printf("Rocket connected.\n");

	return 1;
}

static int rocket_update()
{
	DWORD playCursor;
	buf->GetCurrentPosition(&playCursor, NULL);
	int row = (int)(playCursor / (SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE)));

	if (sync_update(device, row, &cb, 0))
		sync_tcp_connect(device, "localhost", SYNC_DEFAULT_PORT);

	return 1;
}

static const struct sync_track *s_tracks[NUM_TRACKS];

void entrypoint(void)
{
	device = sync_create_device("localsync");
	if (!device)
	{
		printf("Unable to create rocketDevice\n");
		return;
	}

	cb.is_playing = xis_playing;
	cb.pause = xpause;
	cb.set_row = xset_row;

	if (sync_tcp_connect(device, "localhost", SYNC_DEFAULT_PORT))
	{
		printf("Rocket failed to connect\n");
		return;
	}

	printf("Rocket connected.\n");

	for (int i = 0; i < sizeof_array(s_trackNames); ++i)
		s_tracks[i] = sync_get_track(device, s_trackNames[i]);

		// initialize window
#ifdef WINDOW
	HWND window = CreateWindow("static", 0, WS_POPUP | WS_VISIBLE, 0, 0, XRES, YRES, 0, 0, 0, 0);
	const HDC hDC = GetDC(window);
#else // full screen, the default behaviour
	ChangeDisplaySettings(&screenSettings, CDS_FULLSCREEN);
	ShowCursor(0);
	HWND window = CreateWindow((LPCSTR)0xC018, 0, WS_POPUP | WS_VISIBLE | WS_MAXIMIZE, 0, 0, 0, 0, 0, 0, 0, 0);
	const HDC hDC = GetDC(window);
#endif

	LPDIRECTSOUND lpds;
	DirectSoundCreate(0, &lpds, 0);

	lpds->SetCooperativeLevel(window, DSSCL_PRIORITY);
	lpds->CreateSoundBuffer(&bufferDesc, &buf, NULL);

	LPVOID p1;
	DWORD l1;

	buf->Lock(0, 2 * MAX_SAMPLES * sizeof(SAMPLE_TYPE), &p1, &l1, NULL, NULL, NULL);
	CreateThread(0, 0, (LPTHREAD_START_ROUTINE)_4klang_render, p1, 0, 0);

	// initalize opengl context
	SetPixelFormat(hDC, ChoosePixelFormat(hDC, &pfd), &pfd);
	wglMakeCurrent(hDC, wglCreateContext(hDC));

	// create and compile shader programs
	pidMain = ((PFNGLCREATESHADERPROGRAMVPROC)wglGetProcAddress("glCreateShaderProgramv"))(GL_FRAGMENT_SHADER, 1, &shader_sync_frag);
	CHECK_ERRORS();

	SelectObject(hDC, CreateFont(260 * YRES / 1080, 0, 0, 0, FW_DONTCARE, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, FF_DONTCARE | DEFAULT_PITCH, "Verdana"));
	wglUseFontBitmaps(hDC, 0, 256, 0);
	glRasterPos2s(-1, 0);
	static const char str[] = "unnamed";
	glCallLists(7, GL_UNSIGNED_BYTE, str);

	glBindTexture(GL_TEXTURE_2D, 1);

	buf->Play(0, 0, 0);

	DWORD playStatus;

	do
	{
		// First time this copies the font to texture unit 0 bound to texture 1
		// Subsequent times this copies the screen to texture unit 1 bound to texture 0 for post processing		
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
		glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
		((PFNGLGENERATEMIPMAPPROC)wglGetProcAddress("glGenerateMipmap"))(GL_TEXTURE_2D);
		glRects(-1, -1, 1, 1);

		SwapBuffers(hDC);

		(((PFNGLACTIVETEXTUREPROC)wglGetProcAddress("glActiveTexture")))(GL_TEXTURE1);

#if !(DESPERATE)
		// do minimal message handling so windows doesn't kill your application
		// not always strictly necessary but increases compatibility and reliability a lot
		// normally you'd pass an msg struct as the first argument but it's just an
		// output parameter and the implementation presumably does a NULL check
		PeekMessage(0, 0, 0, 0, PM_REMOVE);
#endif
		rocket_update();

		// render with the primary shader
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(pidMain);
		CHECK_ERRORS();

		DWORD playCursor;
		buf->GetCurrentPosition(&playCursor, NULL);

		float syncs[NUM_SYNCS];
		syncs[0] = (float)(playCursor) / (SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE));

		float row_f = (float)(playCursor) / (SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE));
		for (int i = 0; i < NUM_TRACKS; ++i)
		{
			syncs[i + 1] = sync_get_val(s_tracks[i], row_f);
		}

		for (int i = 0; i < MAX_INSTRUMENTS; i++)
		{
			DWORD synctime = playCursor / (2 * sizeof(SAMPLE_TYPE) * 256) * 32;
			syncs[1 + NUM_TRACKS + i] = _4klang_envelope_buffer[synctime + i];
		}

		((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(2, NUM_SYNCS, syncs);
		CHECK_ERRORS();

		glRects(-1, -1, 1, 1);
		CHECK_ERRORS();

		syncs[0] = -syncs[0];
		((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(2, NUM_SYNCS, syncs);
	} while (!GetAsyncKeyState(VK_ESCAPE));

	ExitProcess(0);
}
