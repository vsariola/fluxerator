bits 32

section		.rkconst	data	align=1
c_three		dw		    3

%include "minirocket.inc"

section		.rocket     code    align=1
global  _minirocket_sync@8
_minirocket_sync@8:
    pushad
    xor     ecx, ecx
    mov     esi, row_data  
    mov     edi, start_times    
    fld     dword [esp+36]      ; t
    jmp     .writesync
.syncloop:
    movzx   edx, word [ecx*2+track_data]
    fld     dword [esp+36]      ; t
    fisub   dword [edi+ecx*4]   ; t-t0
    fild    word [esi+edx*2]    ; d t-t0
    fcomip  st1                 ; if (d >= t-t0)  
    jae     .key                ;   goto .key;
    movzx   ebx, word [esi+edx*2]   ; ebx = d
    add     dword [edi+ecx*4], ebx  ; t0 += d
    inc     word [ecx*2+track_data]    ; index++
    jmp     .syncloop
.key:
    fidiv   word [esi+edx*2]    ; a=(t-t0)/d
    test    byte [type_data+edx], 1
	jnz		.out
    fldz            ; 0 a
    fstp    st1     ; a
.out:
    fild    word [value_data+edx*2]    ; v0*256 a	    
    fidiv   word [type_data]           ; v0 a   % WARNING: we assume type data starts with 0x00 0x01 aka word 256... this is not universally true but for this intro it is
    fild    word [value_data+edx*2+2]  ; v1*256 v0 a	    
    fidiv   word [type_data]           ; v1 v0 a    
    fsub    st0, st1    ; v1-v0 v0 a
    fmul    st0, st2    ; a*(v1-v0) v0 a
    faddp   st1         ; v0+a*(v1-v0) a
    fstp    st1         ; v0+a*(v1-v0)
    inc     ecx
.writesync:
    xchg	esi, dword [esp+40] ; esi <-> outptr
    fstp	dword [esi]
    lodsd
    xchg	esi, dword [esp+40] ; esi <-> outptr    
    cmp     ecx, numtracks
    jl      .syncloop
    popad
    ret     8

section		.rtbss      bss		align=1
start_times resd    numtracks    

