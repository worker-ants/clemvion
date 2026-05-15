정식 규약(`spec/conventions/`) 대비 target 문서를 검토합니다.

---

## 발견사항

### [INFO] DRAFT 2I Rationale — review session 참조 경로 불일치
- **target 위치**: DRAFT 2I `## Rationale` 섹션, "callback 실패 status 보존" 근거 단락 끝 `(참고: review/consistency/2026-05-14_16-48-25)`
- **위반 규약**: CLAUDE.md 정보 저장 위치 — 살아있는 문서 내 참조는 실제 경로를 가리켜야 한다
- **상세**: 현재 git 워크트리에 존재하는 consistency 세션 디렉토리는 `2026-05-14_17-00-12/`, `17-12-13/`, `17-21-35/`, `17-31-24/` 4건. `_16-48-25` 에 해당하는 디렉토리가 없음. 이전 실행 세션을 참조하거나 오기입된 가능성.
- **제안**: 실제로 해당 결정을 뒷받침한 세션이 `17-00-12` 또는 다른 타임스탬프인지 확인 후 경로를 갱신하거나, 참조를 삭제.

---

### [INFO] DRAFT 2J-2 — spec 내 TypeScript 예시에 코드 주석 추가
- **target 위치**: DRAFT 2J-2 `verifyHmac` 함수 직전 추가 행
  ```
  + // clientSecret 은 path 의 install_token 으로 조회한 row 의 credentials.client_secret. 단일 호출.
  ```
- **위반 규약**: CLAUDE.md "Default to writing no comments. Only add one when the WHY is non-obvious"
- **상세**: 이 줄이 추가되는 문서는 spec 내 설명용 TypeScript 스니펫이므로 프로덕션 코드 주석 금지 원칙이 직접 적용되지는 않는다. 그러나 동일 스니펫 상단의 함수 설명(식별 전략 단락)이 이미 같은 내용을 서술하고 있어 중복임.
- **제안**: 식별 전략 단락이 이미 충분히 설명하므로 해당 주석 줄을 제거하고, 단락과의 forward-ref(`위 단락 참고`) 한 줄로 대체하거나 삭제.

---

## 요약

Target 문서는 `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/migrations.md`, `spec/conventions/node-output.md` 세 정식 규약과 전반적으로 일치한다. error code는 `UPPER_SNAKE_CASE`, `status_reason`은 `snake_case`, Rationale 섹션 신설은 CLAUDE.md 3섹션 권장에 부합, 마이그레이션 버전 참조(V041·V042)는 신규 파일 선언이 아닌 기존 마이그레이션 기술이므로 migrations 규약 위반 없음. 발견된 두 건은 모두 INFO 등급의 참조 정확성·중복 이슈이며, spec 채택을 차단할 Critical·Warning 항목은 없다.

## 위험도

**LOW**