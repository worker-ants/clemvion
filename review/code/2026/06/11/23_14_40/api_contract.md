# API 계약(API Contract) 리뷰 결과

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 — 이전 리뷰(23_00_44) 결과물 반영 후 후속 변경
**검토 파일**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `review/code/2026/06/11/23_00_44/**`
**검토일**: 2026-06-11

---

## 발견사항

### 1. **[INFO]** `http-request.handler.ts` configEcho 주석 수정 — 이전 세션 WARNING #5 해소

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` lines 157–161 (configEcho 블록 주석)
- **상세**: 이전 리뷰 세션(23_00_44) WARNING #5에서 지적된 "adding a new schema field is automatically echoed without a maintenance step here" 모순 구절이 제거되었다. 신규 주석은 "NOTE: adding a new schema field (http-request.schema.ts) requires adding it here too — this manual sync is intentional" 으로 실제 동작과 일치한다. API 응답 계약 관점에서 config echo 필드 목록의 의미가 코드 독자에게 정확히 전달된다.
- **제안**: 없음. 이전 WARNING 해소 확인.

---

### 2. **[INFO]** `http-request.handler.ts` SSRF 가드 주석 — 이전 세션 WARNING #6 부분 해소

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` lines 341–343 (SSRF 가드 블록 주석)
- **상세**: 이전 세션 WARNING #6에서 지적된 "(W-4)" 내부 검토 태그가 제거되었다. 신규 주석은 "hostname literal 검사만으로는 공격자가 통제하는 DNS 가 공개 hostname 을 내부 IP 로 resolve 하는 DNS rebinding 시나리오에 무방어다"로 구체적인 위협 시나리오를 직접 서술한다. API 계약 문서화 관점에서 외부 독자의 이해도가 향상된다.
- **제안**: 없음. 이전 WARNING 해소 확인.

---

### 3. **[INFO]** `backend-labels.ts` `ERROR_KO`에 `HTTP_BLOCKED` 한국어 메시지 추가 — 이전 세션 WARNING #7 해소

- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts` line 584–585
- **상세**: 이전 리뷰 세션(23_00_44) WARNING #7에서 지적된 `HTTP_BLOCKED` 한국어 메시지 누락이 해소되었다. 추가된 메시지: "보안 정책(SSRF 방지)에 의해 해당 주소로의 요청이 차단됐어요. 내부망·loopback·클라우드 메타데이터 주소는 기본 차단되며, 자체 호스팅 환경에서 사설망 접근이 필요하면 관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요." — 한국어 사용자에게 영문 코드 노출 없이 에러 원인과 opt-out 방법을 안내한다. API 에러 응답의 사용자 경험 일관성이 확보되었다.
- **제안**: 메시지 내용이 opt-out 방법(`ALLOW_PRIVATE_HOST_TARGETS`)을 직접 포함해 운영자 조치 가이드 역할을 겸한다. 이는 이전 세션 WARNING #1(에러 메시지 opt-out 안내 부재) 우선 조치 권고와도 부합한다. 이 메시지가 최종 사용자(워크플로 빌더가 아닌 엔드 유저)에게도 노출되는 경로가 있다면 "관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요"는 과도한 기술 세부 정보일 수 있으나, 워크플로 노드 에러 메시지가 주로 플로우 작성자(내부 운영자)를 대상으로 한다면 현재 수준이 적절하다.

---

### 4. **[INFO]** 이전 세션 WARNING #2(에러 메시지 hostname 노출), WARNING #3(breaking change 안내), WARNING #4(SDK 타입 전파) — 본 변경에서 미해소

- **위치**: `http-safety.ts`(diff 외, hostname 노출), PR 본문(diff 외, breaking change), `packages/sdk`(diff 외, 타입 전파)
- **상세**: 이번 diff(파일 1·2)에는 위 세 항목의 해소가 포함되어 있지 않다. 이전 세션 SUMMARY 권장 조치 1~3번 항목이다.
  - WARNING #2: `http-safety.ts` 에러 메시지에 hostname/IP 노출 → 클라이언트에 일반화된 메시지 반환 미적용
  - WARNING #3: PR 본문·릴리스 노트 breaking change 명시 → 코드 변경 범위 밖(PR 기술 문서)
  - WARNING #4: `ErrorCode` SDK public 타입 전파 확인 → diff 상 SDK 패키지 변경 없음
- **제안**: WARNING #2는 `http-safety.ts` 수정으로 해소 가능. WARNING #3은 PR 본문 작성 시 적용. WARNING #4는 SDK 타입 배포 프로세스 확인 후 필요시 bump. 이번 diff 범위 내 조치 불필요.

---

## 요약

이번 변경(파일 1·2)은 이전 리뷰 세션(23_00_44)에서 지적된 WARNING 중 **WARNING #5·#6·#7** 세 건을 해소한다. configEcho 주석 모순 구절 제거(파일 1), SSRF 가드 주석 내 내부 검토 태그 제거(파일 1), `HTTP_BLOCKED` 한국어 에러 메시지 추가(파일 2)가 이에 해당한다. API 계약 관점에서 새로 도입된 breaking change나 에러 응답 형식 변경은 없다. 나머지 파일(review/code/23_00_44/**)은 리뷰 산출물로 API 계약 검토 대상이 아니다. 이전 세션 WARNING #1·#2·#3·#4는 본 diff 범위 밖에 있어 잔존한다.

---

## 위험도

LOW

(이전 세션 WARNING 3건 해소 확인. API 계약 관점 신규 발견 없음. 잔존 WARNING #1·#2·#3·#4는 이전 세션에서 이미 식별·기록된 항목이며 이번 변경으로 신규 생성된 것이 아님.)
