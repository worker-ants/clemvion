## 발견사항

- **[INFO]** `spec/conventions/secret-store.md` §3.3 — 인라인 설명 개선 확인
  - 위치: line 36 (`표준` → `표준 형식`) 수정
  - 상세: 단어 한 개 추가로 의미 명확화. 실질적 내용 변경은 없으며 가독성 향상 수준.
  - 제안: 현 상태 적절.

- **[INFO]** `spec/conventions/secret-store.md` §3.3 — 신규 fail-closed 동작 인라인 문서화
  - 위치: line 39 (새 bullet)
  - 상세: 추가된 bullet 이 `.env.example` placeholder 의미, production 부팅 거부 조건(all-zero·옛 `0123…`), dev 영향 없음을 한 단락에 밀도 있게 설명한다. `assertProductionConfig`, `main.ts`, refactor tag(04 M-4)까지 모두 참조해 추적 가능성이 높다.
  - 제안: 현 상태 적절.

- **[INFO]** `spec/conventions/secret-store.md` Rationale R5 신설
  - 위치: lines 48–57
  - 상세: 보안 결정의 배경(왜 two-layer guard인지), 역사적 맥락(옛 구체 예시 키 → 복붙 사고), 응집 이유(`JWT_SECRET`/`MCP_ALLOW_INSECURE_URL`과 단일 블록)를 서술한다. 교차 링크(`1-auth.md#rationale`)도 포함. 결정 근거(Rationale)의 단일 진실 원칙을 잘 따른다.
  - 제안: 현 상태 적절.

- **[WARNING]** `.env.example` 148번째 줄 주석이 `parseMasterKey` 실제 동작과 모순
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/.env.example` 148번째 줄
  - 상세: 해당 줄은 `# Empty value disables encryption (dev only — credentials stored in plaintext).` 라고 서술하나, `secret-crypto.ts` 의 `parseMasterKey` 함수는 빈 문자열 입력 시 즉시 `throw new Error('ENCRYPTION_KEY is not set …')` 로 fail-fast 한다. "평문 저장" 폴백은 코드 어디에도 존재하지 않는다. 이번 diff 의 spec §3.3 신규 bullet 에서 "빈 문자열이면 fail-fast" 라고 올바르게 서술하고 있어 `.env.example` 주석만 부정확하다.
  - 제안: 라인 148을 `# Empty value → boot fails (parseMasterKey throws). Must always be set.` 으로 교체 혹은 삭제하여 실제 동작과 일치시킬 것. 이번 변경이 해당 주석을 직접 건드리지 않았으나, 신규 spec 문서와 직접 모순되므로 같은 PR 에서 함께 수정하는 것이 적절하다.

- **[WARNING]** `production-guards.ts` 파일 주석 — `INTERACTION_JWT_SECRET` 링크가 코드 상대경로만 있고 spec 참조 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` line 7
  - 상세: 주석에서 `INTERACTION_JWT_SECRET` 의 fail-closed 를 `../../modules/external-interaction/interaction-token.service.ts` 로만 링크하고 있다. spec 독자 혹은 신규 기여자가 문서를 통해 추적할 경로가 없다. spec `5-system/1-auth.md` 의 Production fail-closed 가드 섹션이 신설됐으므로, 해당 spec 섹션 참조를 병기하면 문서-코드 연결이 완성된다.
  - 제안: 코드 주석에 `SoT: spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 병기.

- **[INFO]** `.env.example` `ENCRYPTION_KEY` 주석 — production 부팅 거부 안내 포함 여부
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/.env.example` lines 150–153
  - 상세: `!! MUST regenerate`, `!! Generate with: openssl rand -hex 32`, `NODE_ENV=production refuses to boot if this placeholder is used` 설명이 모두 포함돼 운영자가 파일만 읽어도 위험을 인지할 수 있다. spec §3.3 의 서술과 정합한다.
  - 제안: 현 상태 적절.

- **[INFO]** `INTEGRATION_ENCRYPTION_KEY` — `.env.example` 주석 개선 여지
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/.env.example` line 156~160
  - 상세: `INTEGRATION_ENCRYPTION_KEY` 는 `assertProductionConfig` 체크 대상이 아니나(spec §비대상 일치), `REQUIRED for production` 안내만 있고 구체적인 생성 명령이나 fail-closed 없음 표시가 없다. `ENCRYPTION_KEY` 와 나란히 놓이면 혼동 여지가 있다.
  - 제안: `# !! Generate with: openssl rand -base64 32` 한 줄과 `# (production boot guard 없음 — Integration OAuth 전용)` 안내 추가 고려. LOW 우선순위, 이번 PR 범위 밖 가능.

- **[INFO]** CHANGELOG 업데이트 필요성
  - 위치: 프로젝트 루트
  - 상세: `plan/` 에 refactor 04 M-4 작업이 추적됐고 커밋 메시지에 `docs(spec)` 태그가 명시돼 있으므로 별도 CHANGELOG 파일이 없는 프로젝트 구조에서는 추가 조치 불필요.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 순수 spec/문서 갱신으로, `secret-store.md` 에 production fail-closed 가드의 동작 설명(§3.3 bullet)과 그 배경(R5 Rationale)을 신설했다. 추가된 문서는 `production-guards.ts` 와 `main.ts` 구현과 전반적으로 정합하며, 교차 링크와 refactor 태그로 추적 가능성도 높다. 핵심 지적은 두 가지다. 첫째, `.env.example` 148번째 줄 "Empty value disables encryption" 주석은 `parseMasterKey` 의 실제 fail-fast 동작과 모순되며 신규 spec §3.3 과도 직접 충돌한다. 둘째, `production-guards.ts` 코드 주석의 `INTERACTION_JWT_SECRET` 참조가 코드 내부 경로만 있어 spec 문서 독자에게는 추적 경로가 없다. 나머지 항목은 낮은 우선순위의 개선 제안 수준이다.

---

## 위험도

LOW
