# 보안(Security) 리뷰

## 발견사항

### **[INFO]** MIME 타입 화이트리스트 — `image/svg+xml` 포함
- 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L35, `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `DEFAULT_FILE_ALLOWED_MIME_TYPES`
- 상세: `image/svg+xml` 이 기본 허용 목록에 포함되어 있다. SVG는 `<script>` 태그, `<a href="javascript:...">`, `onload` 이벤트 핸들러 등을 포함할 수 있어 파일이 직접 브라우저에 서빙될 경우 XSS 벡터가 된다. 현재 구현은 binary 미전달(§1.5 metadata-only), 서버가 파일을 저장·서빙하지 않으므로 **현 시점에서는 무해**하다. 이전 리뷰(12_09_39 RESOLUTION INFO#14)에서 동일 사항이 defer 처리되었다.
- 제안: 파일 저장·서빙 경로(CDN/오브젝트 스토리지) 도입 시 SVG를 별도 origin에서 `Content-Type: image/svg+xml` + `Content-Disposition: attachment` + CSP로 격리하거나 기본 허용 목록에서 제거할 것. 현재 단계에서는 조치 불필요.

### **[INFO]** 클라이언트측 MIME 검증의 우회 가능성 (Defense-in-depth 확인)
- 위치: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `validateFilesClient` 함수
- 상세: 클라이언트(브라우저)가 제공하는 `File.type` 은 파일 확장자나 브라우저 구현에 의존하므로 공격자가 HTTP 직접 호출로 우회하거나 브라우저 API를 조작해 임의 MIME 값을 제출할 수 있다. 단, 이 코드는 UX 1차 게이트 역할만 하며 최종 검증은 서버측 `validateFileField`(`assertFormSubmissionValid` chokepoint)에서 수행하도록 설계되어 있다(§1.5). 클라이언트 검증이 보안 경계가 아님이 코드·JSDoc에 명시되어 있어 설계 의도는 올바르다.
- 제안: 현행 설계 유지. 단, `validateFilesClient` JSDoc에 "이 함수는 UX 가드 전용이며 보안 게이트가 아님 — 서버측 `validateFileField`가 최종 게이트" 한 줄을 추가하면 향후 유지보수자 혼동을 예방할 수 있다.

### **[INFO]** `validation.pattern` 필드 — ReDoS 방어 유효성 확인
- 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L281–295 (`validateScalarField`)
- 상세: `pattern` 은 노드 관리자(신뢰 경계) 전용이며 `MAX_PATTERN_LENGTH = 512` cap과 invalid regex catch 처리가 존재한다. 일반 폼 제출자 입력에서 패턴이 오지 않으므로 ReDoS 공격면이 작다. 이전 리뷰(12_09_39 INFO#15)에서 동일 결론으로 defer되었다.
- 제안: 현행 유지. 미래에 일반 사용자가 pattern을 설정할 수 있는 경로가 생기면 `re2` 또는 non-backtracking 엔진 도입을 검토할 것.

### **[INFO]** 에러 메시지에서 파일 크기·개수 수치 노출
- 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L383, L397, L405 (`validateFileField`)
- 상세: 오류 메시지에 `${def.maxFileSize}`, `${def.maxTotalSize}`, `${def.maxFiles}` 값이 직접 포함된다. 이 값들은 서버 설정 상수이므로 민감 정보 노출이 아니다. 제한 값을 공개하는 것은 UX 상 의도된 동작이며 보안 문제가 없다.
- 제안: 없음.

### **[INFO]** MIME 타입 검증이 파일 내용(magic bytes)이 아닌 metadata에 의존
- 위치: `validateFileField` (서버측) 및 `validateFilesClient` (클라이언트측)
- 상세: 서버측 `validateFileField`는 `m.type` 문자열만 검사하며 실제 파일 content를 inspect하지 않는다. 이는 §1.5 metadata-only 설계 상 의도된 것이다. 공격자가 실행파일에 `type: 'image/png'`를 부여해 제출하면 MIME 검증을 통과할 수 있다. 그러나 현재 아키텍처에서 서버는 binary를 수신·저장하지 않으므로(metadata-only payload) 실제 악성 파일 업로드 경로가 없다.
- 제안: 파일 저장 기능 도입 시 서버측 magic bytes 검증(예: `file-type` npm 패키지) 또는 안티바이러스 스캔을 추가할 것. 현재 단계에서는 불필요.

---

## 요약

이번 변경(type:'file' 서버측·클라이언트 검증 + 공유 기본값)은 보안 관점에서 견고하게 구현되어 있다. 필드명 정규화(`FIELD_NAME_RE`)로 경로 탐색 및 인젝션을 차단하고, MIME 화이트리스트 + 크기·개수 제한을 서버 chokepoint에서 강제하며, 입력 검증은 서버측을 최종 게이트로 삼고 클라이언트를 보조 UX 게이트로 분리한 설계가 올바르다. 하드코딩된 시크릿 없음, 평문 전송 없음, 인증/인가 우회 경로 없음, SQL/XSS/커맨드 인젝션 취약점 없음. `image/svg+xml` 기본 허용 및 metadata-only MIME 검증의 한계는 현 아키텍처(binary 미전달)에서 실제 공격 경로가 없으며, 파일 서빙 기능 도입 시 처리가 필요한 사항으로 기존 리뷰에서 이미 defer 결정된 항목이다.

## 위험도

LOW
