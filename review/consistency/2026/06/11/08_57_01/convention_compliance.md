# 정식 규약 준수 검토 — spec/data-flow/

검토 대상 브랜치: `auth-refresh-rotation-atomic`
diff base: `origin/main`
실제 변경 파일: `spec/data-flow/2-auth.md` (단일 파일 변경)

---

## 발견사항

### **[WARNING]** §1.4 내부에 §1.4 를 잘못 지칭하는 자기참조 교차 링크

- **target 위치**: `spec/data-flow/2-auth.md` 라인 184 (추가된 블록)
  ```
  WebAuthn 등록(§1.4 본문에서 "단일 트랜잭션" 을 이미 명시)과 동일한
  ```
- **위반 규약**: `spec/data-flow/0-overview.md §3.2` — 다이어그램의 핵심 파일·메서드 참조 정확성 요건. CLAUDE.md §정보 저장 위치 — 단일 진실 원칙.
- **상세**: 추가된 주석이 "§1.4 본문에서 단일 트랜잭션을 이미 명시" 라고 쓰고 있지만, 이 문장이 위치한 곳이 곧 §1.4 (Refresh token 회전) 본문이다. WebAuthn 등록은 `spec/data-flow/2-auth.md` 안에 별도 §1.x 섹션이 없으며(Passkey 등록은 §2.1 Schema 매핑 표에만 행으로 등장), 단일 트랜잭션을 "이미 명시"한 선행 section 이 이 문서 내에 존재하지 않는다. 독자가 §1.4 본문 내 자기참조로 읽을 수 있어 혼란을 유발한다.
- **제안**: 지칭 대상을 실제 경로로 교체한다. WebAuthn 등록이 단일 트랜잭션을 명시한 곳이 `spec/5-system/1-auth.md` 의 특정 절이라면 그 링크를 쓰거나, 아니면 이 수식어 자체를 제거하고 현재 회전 흐름에 대한 독립적 서술로 남긴다.

---

### **[INFO]** 비표준 요구사항 라벨 `(05 C-1)` 사용

- **target 위치**: `spec/data-flow/2-auth.md` 라인 179 (추가된 블록)
  ```
  > **회전 원자성 (05 C-1)**: ...
  ```
- **위반 규약**: `spec/data-flow/` 폴더 내 다른 문서들이 사용하는 요구사항 라벨 패턴은 도메인 prefix + 순번(`AGM-08`, `WH-EP-02`, `R-CC-12`, `W-1` 등)이다. 이는 `spec/conventions/` 에 명문화된 explicit 규약은 아니나, 폴더 내 기존 documents 의 일관된 패턴이다.
- **상세**: `(05 C-1)` 는 plan/task 번호 체계(숫자 prefix + letter + 숫자)로 보이며, spec 외부의 plan 문서 문맥에서 파생된 식별자다. spec 문서가 plan 내부 ticket 번호를 규범적 요구사항 ID 로 사용하면 plan 완료 후 해당 식별자가 dead reference 가 된다.
- **제안**: 도메인 prefix 기반 표준 ID (`AUTH-ROT-01` 등) 로 교체하거나, 특별히 추적이 불필요하면 라벨을 제거하고 텍스트 서술만 남긴다. 혹은 이 pattern 을 `spec/data-flow/` 폴더의 정식 규약으로 채택하고 `0-overview.md §3.x` 에 명시한다.

---

### **[INFO]** `spec/data-flow/` 폴더 파일들에 frontmatter 없음 — 의도적 면제 확인

- **target 위치**: `spec/data-flow/` 폴더 전체 (15개 파일)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` frontmatter 의무 적용 범위 목록.
- **상세**: `spec/data-flow/` 는 frontmatter 의무 범위(`spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/`)에 포함되지 않는다. 따라서 이 폴더의 모든 파일에 frontmatter 가 없는 것은 현재 가드 기준으로는 위반이 아니다.
- **제안**: 의도적 면제라면 현 상태 유지. 향후 `spec/data-flow/` 가 구현 coverage tracking 대상이 되어야 한다면 `spec-impl-evidence.md §1` 적용 범위에 추가하고 각 파일에 frontmatter 를 도입한다. 본 검토에서는 발견 사항으로만 기록한다.

---

## 요약

`spec/data-flow/2-auth.md` 의 변경(refresh token 회전 원자성 추가)은 전반적으로 규약을 잘 따르고 있다. 에러 코드 표기(`TOKEN_INVALID`, `TOKEN_EXPIRED`, `ACCOUNT_LOCKED`)는 `UPPER_SNAKE_CASE` 를 준수하고, 문서 구조(Overview / Source→Sink / Schema / 상태 전이 / 외부 의존 / Rationale)도 폴더 규약에 맞다. 단, 추가된 주석에서 §1.4 가 자기 자신을 선행 근거로 인용하는 오류가 있어 독자 혼란을 유발할 수 있다(WARNING). 요구사항 라벨 `(05 C-1)` 는 plan 내부 번호를 spec에 노출시키는 비일관 패턴이나(INFO), spec 문서 채택 여부를 명확히 하면 해결된다.

## 위험도

LOW
