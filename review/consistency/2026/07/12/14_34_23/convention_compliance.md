> **복구본**: 원 sub-agent 의 disk write 가 harness 에 의해 유실됨(disk-write gap). 아래는 workflow journal.jsonl 의 반환값에서 그대로 복구한 전문이다(main Claude 재집계).

### 발견사항

- **[WARNING] Edit E 범위가 좁아 `i18n-userguide.md` 문서 내부 정합성이 깨질 위험**
  - target 위치: §4 "적용할 spec 변경" · Edit E (i18n-userguide.md §적용 범위)
  - 위반 규약: `spec/conventions/i18n-userguide.md` §적용 범위 및 그 하위 Rationale "왜 channel-web-chat 위젯은 dict-indirection 스코프 밖인가"(242~254행), 그리고 문서 자체가 유지하는 "자동 가드 요약" 표(204~216행)
  - 상세: 현재 `i18n-userguide.md`는 위젯 제외 근거를 §적용 범위 **본문**뿐 아니라 그 아래 전용 **Rationale 하위섹션**("위젯 UI 가 v1 Korean-only … EN 위젯 지원 착수 시 본 제외를 재검토한다")에도 명시해 뒀고, "자동 가드 요약" 표는 Principle별 가드 위치를 인덱싱한다. target의 Edit E 설명은 "§적용 범위" 문구 개정만 언급하고, 이 Rationale 하위섹션(이제 "위젯은 스코프 밖" 이라는 전제가 chrome 한정으로 무효화됨)이나 신설되는 "위젯 로컬 parity 테스트" 를 자동 가드 요약 표에 반영하는 것은 명시하지 않는다. Edit E가 이 좁은 범위대로만 적용되면 문서 안에 "chrome은 이제 대상"(§적용 범위)과 "위젯은 dict-indirection 스코프 밖"(Rationale)이라는 상충하는 서술이 동시에 남는다.
  - 제안: Edit E 서술에 (1) 해당 Rationale 하위섹션을 "chrome 은 위젯 로컬 catalog 로 편입, 운영자 콘텐츠·인라인은 여전히 제외" 로 갱신, (2) "자동 가드 요약" 표에 위젯 로컬 parity 테스트 행 추가를 명시적으로 포함시킬 것.

- **[INFO] 위젯 로컬 catalog 제안 EN copy 의 보간 문법이 기존 product-wide 컨벤션과 다름**
  - target 위치: §3.5 표의 "제안 EN(draft)" 열 (`launcher.tsx:35`→"{count} unread messages", `presentations.tsx:202`→"Showing some of {count} items.")
  - 위반 규약: 강한 위반은 아님 — `spec/conventions/i18n-userguide.md` Principle 3-C가 명시한 "기존 `core.ts` 의 `interpolate()` + `{{name}}` 이중 중괄호 컨벤션을 재사용한다(신규 보간 문법 금지)" 는 backend 동적 메시지 스코프에 한정되어 위젯에 직접 적용되지는 않음.
  - 상세: target §3.1은 위젯 함수 시그니처를 `t(key, params?)` 로 정의해 메인 앱의 `translate()/t()` 패턴을 의도적으로 모사한다. 그런데 예시 EN copy는 `{count}` 단일 중괄호를 쓰고 있어, 실제 구현 시 개발자가 어느 보간 문법을 따를지 spec이 규범화하지 않은 상태다.
  - 제안: §3.1 또는 §3.4에 "보간 문법은 기존 `{{name}}` 이중 중괄호와 통일한다"는 한 줄을 추가해 향후 제품 전반 문자열 보간 문법 일관성을 규범화(또는 의도적으로 다르게 간다면 그 이유를 Rationale에 명시).

- **[INFO] `PROJECT.md §변경 유형 → 갱신 위치 매핑` 표에 신규 위젯 i18n 갱신 의무 행 부재**
  - target 위치: §8 "후속 (구현 핸드오프)"
  - 위반 규약: 직접 위반은 아님(`PROJECT.md`는 `spec/conventions/**` 밖) — 다만 `spec/conventions/i18n-userguide.md` 서문이 "위치 매핑·검증 명령은 `PROJECT.md §변경 유형 → 갱신 위치 매핑` 의 표를 따른다"고 명시하므로 정식 규약 생태계와 직결됨.
  - 상세: 이 표는 "신규 UI 문자열(TSX)" 같은 기존 행처럼, 위젯 chrome 문자열 추가 시 필수 갱신 위치(위젯 로컬 catalog `{ko,en}` 양쪽 + parity 테스트)를 명문화해 사후 보정 PR 패턴을 차단하는 화이트리스트다. target은 위젯에 이런 신규 자동 가드를 도입하면서도 이 표에 대응 행을 추가하는 작업을 §8 후속 항목에 포함하지 않았다.
  - 제안: §8에 "PROJECT.md 갱신 위치 매핑 표 + `.claude/config/doc-sync-matrix.json`에 위젯 chrome i18n 행 추가"를 구현 완료 조건으로 명시.

### 요약
`plan/in-progress/spec-draft-webchat-en-i18n.md`는 명명 규약(파일명 `spec-draft-<name>.md`, dict 키 네임스페이스, `§번호+R#` Rationale ID 스킴 — 실제 `1-widget-app.md`의 R4~R9 다음 R10 확인됨), plan frontmatter 스키마(worktree/started/owner + `spec_impact` 리스트), 그리고 정식 규약이 예약해 둔 재검토 절차("EN 위젯 지원 착수 시 본 제외를 재검토한다")를 대체로 정확히 따르고 있어 CRITICAL 위반은 발견되지 않았다. 다만 5개 Edit 중 `i18n-userguide.md`를 건드리는 Edit E의 서술 범위가 그 문서 자체의 Rationale 하위섹션·자동 가드 요약 표까지 포괄하지 않아, 그대로 적용하면 정식 규약 문서 내부에 상충하는 서술이 남을 위험이 있다(WARNING 1건). 그 외 보간 문법 통일과 `PROJECT.md` 갱신-위치 매핑 표 동반 갱신은 완결성 제안(INFO) 수준이다. 참고로 본 검토에 제공된 `spec/conventions/**` 번들 payload는 `audit-actions.md`·`cafe24-api-catalog/*` 로 조기 절단돼 있어(대상 문서와 무관), 실제 관련 규약인 `spec/conventions/i18n-userguide.md`는 저장소에서 직접 읽어 대조했다.

### 위험도
LOW
