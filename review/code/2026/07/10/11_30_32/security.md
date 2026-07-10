### 발견사항

- **[INFO]** GitHub Actions 워크플로 커맨드 escaping이 property 값(`file=`)에는 불완전
  - 위치: `scripts/report_playwright_flaky.py` `_gha_escape()`, `_emit_annotations()` (annotation의 `file={...}` 부분)
  - 상세: 이번 커밋에서 신설된 `_gha_escape`는 `%`→`%25`, `\r`→`%0D`, `\n`→`%0A`만 처리한다. 이는 GitHub Actions 워크플로 커맨드의 **message(data)** 이스케이프 규칙(`escapeData`)과 동일하지만, `::warning file=...::` 의 `file=` 은 **property 값**이라 GitHub 공식 toolkit(`escapeProperty`)은 추가로 `:`→`%3A`, `,`→`%2C` 도 이스케이프한다. `file` 값(spec 파일 경로)에 쉼표가 포함되면 이론상 property 목록에 새 key=value 를 주입하거나 어노테이션 포맷을 깨뜨릴 수 있다. 다만 `file` 값의 출처가 저장소 내부 e2e 스펙 경로(저자 통제)이고 fork PR 기본 `GITHUB_TOKEN` 도 read-only라 실질 익스플로잇 경로는 없음 — 직전 리뷰(11_02_46) INFO 1 을 부분적으로만 해소한 잔여 갭.
  - 제안: `_emit_annotations` 의 `file=` 값에는 `,`/`:` 도 이스케이프하는 property-전용 변형(`_gha_escape_property`)을 별도로 두면 GitHub 공식 규칙과 완전히 일치한다. 우선순위는 낮음(필수 아님).

- **[INFO]** `main()` 의 blanket `except Exception`이 예외 내용을 그대로 print
  - 위치: `scripts/report_playwright_flaky.py:main()` (`except Exception as exc: print(f"... {exc!r}")`)
  - 상세: 예상 밖 스키마에도 CI를 깨지 않기 위한 의도된 방어(W4 조치)이며 `BaseException`(KeyboardInterrupt/SystemExit)은 잡지 않아 범위가 적절하다. 노출되는 값은 파싱 중 발생한 예외의 repr(내부 경로·타입 오류 메시지 정도)로, 시크릿이나 민감정보를 포함할 가능성은 없음(입력 소스가 Playwright 자체 생성 JSON).
  - 제안: 현재로는 조치 불필요. 참고용.

- **[INFO]** 이번 변경은 이전 리뷰(session 11_02_46)의 security INFO 1(워크플로 커맨드 injection class)에 대한 하드닝(`_gha_escape` 도입)이자 개선. 새로운 취약점 유형은 도입되지 않음.

### 요약

이번 diff는 Playwright flaky 관측 CI 스크립트(`scripts/report_playwright_flaky.py`)의 견고성·게이팅·경로 정합을 다루는 순수 CI 인프라 리팩터로, 신규 서드파티 의존성 도입 없음(stdlib 전용), 하드코딩된 시크릿 없음, SQL/커맨드/경로 인젝션·인증/인가 로직 변경 없음, 평문 전송이나 암호화 관련 코드도 없다. 유일하게 보안과 접점이 있는 부분은 GitHub Actions `::warning::` 워크플로 커맨드에 리포트 값(`file`/`title`)을 삽입하는 지점인데, 이번 커밋이 신설한 `_gha_escape`(개행·`%` 이스케이프)로 직전 리뷰가 지적한 커맨드 인젝션 클래스를 상당 부분 완화했다. 다만 `file=` 은 워크플로 커맨드의 property 값이라 GitHub 공식 규칙상 `,`/`:` 도 이스케이프해야 완전하나, 값의 출처가 저장소 내부 e2e 스펙 경로(공격 표면 아님)이므로 실질 리스크는 낮다. Critical/Warning 급 보안 이슈는 발견되지 않았다.

### 위험도
LOW