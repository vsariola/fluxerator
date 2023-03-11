// minify windows.h
#pragma warning( disable : 6031 6387)
#define WIN32_LEAN_AND_MEAN
#define WIN32_EXTRA_LEAN
#define VC_LEANMEAN
#define VC_EXTRALEAN
#include <windows.h>
#include <mmsystem.h>
#include <mmreg.h>
#include <dsound.h>
#include <GL/gl.h>

// Defining OPENGL_DEBUG makes the CHECK_ERRORS() macro show the error code in messagebox.
// Without the macro, CHECK_ERRORS() is a nop.
#include "debug.h"

#include "glext.h"
#include "4klang.h"
#include <minirocket.h>
#ifdef SYNC
#include "../extern/rocket/lib/sync.h"
#include <minirocket_tracknames.h>
#endif

#pragma data_seg(".shader")
#include <shader.inl>

#pragma data_seg(".pixelfmt")
static const PIXELFORMATDESCRIPTOR pfd = {
	sizeof(pfd), 1, PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER, PFD_TYPE_RGBA,
	32, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 32, 0, 0, PFD_MAIN_PLANE, 0, 0, 0, 0
};

#pragma data_seg(".screensettings")
static DEVMODE screenSettings = {
	{0}, 0, 0, sizeof(screenSettings), 0, DM_PELSWIDTH | DM_PELSHEIGHT,
	{0}, 0, 0, 0, 0, 0, {0}, 0, 0, XRES, YRES, 0, 0,
	#if(WINVER >= 0x0400)
		0, 0, 0, 0, 0, 0,
			#if (WINVER >= 0x0500) || (_WIN32_WINNT >= 0x0400)
			0, 0
		#endif
	#endif
};

#pragma data_seg(".wavefmt")
static WAVEFORMATEX WaveFMT =
{
#ifdef FLOAT_32BIT
	WAVE_FORMAT_IEEE_FLOAT,
#else
	WAVE_FORMAT_PCM,
#endif
	2,                                   // channels
	SAMPLE_RATE,                         // samples per sec
	SAMPLE_RATE * sizeof(SAMPLE_TYPE) * 2, // bytes per sec
	sizeof(SAMPLE_TYPE) * 2,             // block alignment;
	sizeof(SAMPLE_TYPE) * 8,             // bits per sample
	0                                    // extension not needed
};

#pragma data_seg(".descfmt")
static DSBUFFERDESC bufferDesc = { sizeof(DSBUFFERDESC), DSBCAPS_GETCURRENTPOSITION2 | DSBCAPS_GLOBALFOCUS | DSBCAPS_TRUEPLAYPOSITION, 2 * MAX_SAMPLES * sizeof(SAMPLE_TYPE), NULL, &WaveFMT, NULL };

#pragma bss_seg(".pid")
// static allocation saves a few bytes
static int pidMain;

#pragma data_seg(".timediv")
static float TIME_DIVISOR = SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE);

#pragma data_seg(".overtxt")
static const char overtext[] = " unnamed chlumpie & pestis";

#ifdef SYNC
static struct sync_device* device;
static struct sync_cb cb;
static const struct sync_track* s_tracks[NUM_TRACKS];

static void pause(void* data, int flag)
{
	LPDIRECTSOUNDBUFFER buf = *((LPDIRECTSOUNDBUFFER*)data);
	if (flag)
		buf->Stop();
	else
		buf->Play(0, 0, 0);
}

static void set_row(void* data, int row)
{
	LPDIRECTSOUNDBUFFER buf = *((LPDIRECTSOUNDBUFFER*)data);
	DWORD newpos = row * 2 * SAMPLES_PER_TICK * sizeof(SAMPLE_TYPE);
	buf->SetCurrentPosition(newpos);	
}

static int is_playing(void* data)
{
	LPDIRECTSOUNDBUFFER buf = *((LPDIRECTSOUNDBUFFER*)data);
	DWORD playStatus;
	buf->GetStatus(&playStatus);
	return playStatus & DSBSTATUS_PLAYING == DSBSTATUS_PLAYING;
}
#endif

void entrypoint(void)
{
	#ifdef SYNC
		device = sync_create_device("localsync");
		if (!device)
		{
			MessageBox(NULL, "Unable to create rocketDevice", NULL, 0x00000000L);
			ExitProcess(0);
		}

		cb.is_playing = is_playing;
		cb.pause = pause;
		cb.set_row = set_row;

		if (sync_tcp_connect(device, "localhost", SYNC_DEFAULT_PORT))
		{
			MessageBox(NULL, "Rocket failed to connect, run Rocket server first", NULL, 0x00000000L);
			ExitProcess(0);
		}

		for (int i = 0; i < NUM_TRACKS; ++i)
			s_tracks[i] = sync_get_track(device, s_trackNames[i]);
	#endif

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
	LPDIRECTSOUNDBUFFER buf;
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

	SelectObject(hDC, CreateFont(160 * YRES / 1080, 0, 0, 0, FW_DONTCARE, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, FF_DONTCARE | DEFAULT_PITCH, "Verdana"));
	#ifdef WINDOW
		wglUseFontBitmaps(hDC, 0, 255, 1000); // 0 does not work as a listbase when using 720p WINDOW, WHY????
		glListBase(1000);
	#else
		wglUseFontBitmaps(hDC, 0, 256, 0);
	#endif	
	CHECK_ERRORS();
	glRasterPos2s(-1, 0);	
	CHECK_ERRORS();
	glCallLists((sizeof(overtext) / sizeof(overtext[0]))-1, GL_UNSIGNED_BYTE, overtext);
	CHECK_ERRORS();

	glBindTexture(GL_TEXTURE_2D, 1);	
	CHECK_ERRORS();

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

		// render with the primary shader
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(pidMain);
		CHECK_ERRORS();

		long playCursor;
		buf->GetCurrentPosition((DWORD*) & playCursor, NULL);

		float syncs[NUM_SYNCS];
#ifdef SYNC
		int row = (int)(playCursor / (SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE)));
		float row_f = (float)(playCursor) / (SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE));

		if (sync_update(device, row, &cb, &buf))
			sync_tcp_connect(device, "localhost", SYNC_DEFAULT_PORT);		

		syncs[0] = (float)(playCursor) / (SAMPLES_PER_TICK * 2 * sizeof(SAMPLE_TYPE));		
		for (int i = 0; i < NUM_TRACKS; ++i)
		{
			syncs[i + 1] = sync_get_val(s_tracks[i], row_f);
		}
#else
		minirocket_sync(
			playCursor / TIME_DIVISOR,
			syncs
		);
#endif
		for (int i = 0; i < MAX_INSTRUMENTS; i++) {
			DWORD synctime = (playCursor / (2 * sizeof(SAMPLE_TYPE) * 256));
			syncs[1 + NUM_TRACKS + i] = _4klang_envelope_buffer[synctime * 32 + i];
		}

		PFNGLUNIFORM1FVPROC glUniform1fvProc = ((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"));
		glUniform1fvProc(2, NUM_SYNCS, syncs);
		CHECK_ERRORS();

		glRects(-1, -1, 1, 1);
		CHECK_ERRORS();

		syncs[0] = -syncs[0];
		glUniform1fvProc(2, NUM_SYNCS, syncs);
		CHECK_ERRORS();


	} while (
		!GetAsyncKeyState(VK_ESCAPE)
		#ifndef SYNC
		&& (buf->GetStatus(&playStatus),playStatus) & DSBSTATUS_PLAYING
		#endif
	);

	ExitProcess(0);
}
