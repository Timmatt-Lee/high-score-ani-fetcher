with open("src/App.test.tsx", "r") as f:
    content = f.read()

# find the last "});"
last_idx = content.rindex("});")

test_case = """
  it("renders SettingsTab when Settings tab is active", () => {
    render(
      <ServiceProvider>
        <App />
      </ServiceProvider>,
    );

    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByTestId("settings-tab")).toBeInTheDocument();
  });
"""

new_content = content[:last_idx] + test_case + content[last_idx:]

with open("src/App.test.tsx", "w") as f:
    f.write(new_content)
