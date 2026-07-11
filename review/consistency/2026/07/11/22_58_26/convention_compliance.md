# 정식 규약 준수 검토 — spec-draft-webchat-truncation-total-count

검토 대상: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` (spec draft, `--spec` 모드)
검토 방식: `spec/conventions/**` 전체(디렉토리 listing 후 관련 문서 개별 확인)를 대상으로 검증. prompt에 번들된
"정식 규약 모음"(`audit-actions.md`, `cafe24-api-catalog/**`)은 target(웹채팅 위젯 presentation)과 도메인이 전혀
무관해 실질 검증에 사용하지 않았고, 대신 `spec-impl-evidence.md` · `node-output.md` · `i18n-userguide.md` 를
직접 조회해 대조했다(orchestrator 번들 선정 이슈로 보이며 target 자체의 결함은 아님).

## 발견사항

- **[WARNING] 신규 배너 문구가 i18n 정식 규약(하드코딩 금지 + 문체 통일)을 위반**
  - target 위치: `## 후속 구현` 절 — "`presentations.tsx` `TableView`: `truncated` 배너 문구를 `총 N개 중 일부만
    표시됩니다.`(totalCount 있을 때) / 없으면 기존 `일부 행만 표시됩니다.` 폴백."
  - 위반 규약: `spec/conventions/i18n-userguide.md` **Principle 1**("UI 문자열은 dict 키 경유, TSX 하드코딩
    금지" — "❌ 금지: JSX text … string literal 에 한국어 문자열을 직접 박는 행위") 및 **Principle 6**("해요체로
    통일(`~합니다`, `~한다` 금지)")
  - 상세: 제안된 새 문구 `총 N개 중 일부만 표시됩니다.` 는 (a) `t()`/`translate()` dict 키 경유 없이 TSX
    literal 로 직접 박히는 계획이고, (b) `~됩니다` 형(합쇼체)이라 Principle 6 이 명시적으로 금지한 문체다.
    `codebase/channel-web-chat` 소스는 `i18n-userguide.md` 의 build 가드(`hardcoded-korean-ratchet.test.ts`)
    스캔 범위(`codebase/frontend/src/{components,app,lib}`) 밖이라 이 신규 문자열이 build 를 깨뜨리진
    않지만, 위젯 자체에 이미 규약을 준수하는 선례가 존재한다 — `codebase/channel-web-chat/src/widget/use-widget.ts:605`
    의 `"일시적인 오류로 대화를 진행할 수 없어요. 잠시 후 새 대화로 다시 시도해 주세요."` 는 해요체다. 즉 위젯
    UI 카피는 관례상 해요체를 따르는데, target 이 대체하려는 기존 문구(`일부 행만 표시됩니다.`)와 신규 문구
    모두 그 관례·정식 규약에서 벗어나 있고, target 은 이 기존 위반을 고치는 대신 같은 패턴으로 확장한다.
  - 제안: 새 문구를 해요체로 조정(예: `총 N개 중 일부만 표시돼요.`)하고, 가능하면 dict 경유(위젯 자체
    i18n 사전이 없다면 최소한 상수 모듈로 분리해 향후 `locale` 분기(`BootConfig.locale: 'ko'|'en'`, 이미
    2-sdk.md §4 에 존재)에 대비). 위젯이 `i18n-userguide.md` 스코프 밖이라 build 가 막히진 않으므로, 이
    결정이 의도적이라면 target 의 "결정" 절에 "위젯은 i18n-userguide 컨벤션 적용 대상이 아님을 확인,
    문체는 기존 관례(해요체) 따름" 처럼 명시해 두는 편이 낫다.

- **[INFO] `implemented` 상태 spec 의 §2 신규 문구가 carousel 미충족 gap 을 승계**
  - target 위치: `## 결정` §2 변경안 — "잘림 표시를 총 개수(...)와 함께 노출한다"
  - 위반(근접) 규약: `spec/conventions/spec-impl-evidence.md` §3 `status: implemented` = "모든 약속 구현 완료"
  - 상세: target 자체의 "스코프 경계" 절이 인정하듯, carousel 은 잘림 배너가 아예 없어 §2 의 일반화된
    "노출한다" 서술이 carousel 엔 미충족이다. 이는 이번 PR 이 새로 만든 gap 이 아니라 기존 §2 문구부터
    이미 존재하던 상태이며, target 은 이를 의식적으로 별도 followup 으로 미루기로 결정했다 — 합리적인
    판단이나, 정작 target 이 편집하는 §2 문장 자체에는 그 범위(table 한정) 가 드러나지 않아 "스코프 경계"
    절을 읽지 않은 독자는 `status: implemented` 서술을 액면 그대로 받아들일 수 있다.
  - 제안: 굳이 status 를 낮추거나 새로 처리할 필요는 없지만, §2 문장에 "(table; carousel 은 별도 추적)" 같은
    최소 caveat 을 넣으면 스코프 경계 절과 본문 서술의 정합이 더 강해진다. 선택 사항 — 강제 아님.

- **[INFO] `{rowsTotalCount|itemsTotalCount}` 표기 순서가 SoT 와 문서 내부에서 불일치**
  - target 위치: `## 실측` 절("`{itemsTotalCount|rowsTotalCount}`") vs `## 결정` §2 절("`{rowsTotalCount|itemsTotalCount}`")
  - 위반(근접) 규약: `spec/4-nodes/6-presentation/0-common.md` §4/§10.4 의 canonical 표기 —
    `output.{itemsTruncated|rowsTruncated}` / `output.{itemsTotalCount|rowsTotalCount}` (items 먼저, rows 나중)
  - 상세: target 문서 안에서 같은 개념을 가리키는 두 인용이 순서가 뒤바뀌어 있다(실측 절은 SoT 순서를
    그대로 인용, 결정 절은 rows-first 로 뒤집힘). 의미상 차이는 없지만 SoT 표기와 어긋나는 인용은 향후
    §2 최종본에 그대로 반영되면 SoT 대조 시 혼동을 줄 수 있다.
  - 제안: §2 최종 문구 작성 시 SoT 순서(`{itemsTotalCount|rowsTotalCount}`)로 통일.

## 요약

target 은 `spec/4-nodes/6-presentation/0-common.md §4/§10.4` 에 이미 정의된 `rowsTotalCount`/`itemsTotalCount`
필드명을 재사용하고 wire·백엔드 무변경을 명시하는 등 출력 포맷·명명 규약은 대체로 잘 지킨다. plan frontmatter
(`worktree`/`started`/`owner`, 리스트 형 `spec_impact`)도 `plan-lifecycle.md`/`spec-impl-evidence.md` 스키마에
합치한다. 다만 "후속 구현" 절에서 제안한 신규 배너 한국어 문구가 `i18n-userguide.md` Principle 1(TSX 하드코딩
금지)·Principle 6(해요체 통일) 을 문언 그대로 위반하며, 이는 build 가드가 `channel-web-chat` 을 스캔하지 않아
차단되지는 않지만 위젯 자체의 기존 해요체 선례(`use-widget.ts`)와도 어긋나는 회피 가능한 결함이다. 그 외
`status: implemented` 문구의 carousel 미충족 gap 승계, SoT 표기 순서 불일치는 사소한 INFO 수준 제안이다.

## 위험도

LOW
